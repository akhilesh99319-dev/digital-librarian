const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { app, startServer } = require('../server');
const { db } = require('../database/db');

async function isServerRunning(port = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function runScript(scriptRelativePath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(__dirname, scriptRelativePath);
    console.log(`\n========================================================================`);
    console.log(`  EXECUTING TEST SUITE: ${scriptRelativePath}`);
    console.log(`========================================================================\n`);

    const proc = spawn('node', [fullPath], {
      stdio: 'inherit',
      env: { ...process.env, PORT: '3000' }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test script ${scriptRelativePath} failed with exit code ${code}`));
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

function restoreCleanBaseline() {
  console.log('\n--> Restoring Clean Authoritative Baseline in SQLite Database...');
  
  // Clean up any test loans and fines
  db.exec(`
    DELETE FROM fines WHERE loan_id IN (SELECT id FROM loans WHERE notes LIKE '%test%' OR notes LIKE '%Test%');
    DELETE FROM loans WHERE notes LIKE '%test%' OR notes LIKE '%Test%' OR return_date IS NULL;
    UPDATE books SET available_copies = total_copies;
    UPDATE loans SET status = 'Returned', return_date = date('now') WHERE return_date IS NULL;
    DELETE FROM fines;
    DELETE FROM loans;
  `);

  console.log('--> Baseline Cleaned. Checking final state:');
  const bookStats = db.prepare('SELECT COUNT(*) as c, SUM(total_copies) as tc, SUM(available_copies) as ac FROM books').get();
  const memCount = db.prepare('SELECT COUNT(*) as c FROM members').get().c;
  const loanCount = db.prepare('SELECT COUNT(*) as c FROM loans WHERE return_date IS NULL').get().c;
  const fineSum = db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM fines WHERE status = 'Unpaid'").get().s;

  console.log(`    Books: ${bookStats.c} titles | Total Copies: ${bookStats.tc} | Available Copies: ${bookStats.ac}`);
  console.log(`    Members: ${memCount} | Active Loans: ${loanCount} | Pending Fines: ₹${fineSum}`);
}

async function main() {
  let serverInstance = null;
  const running = await isServerRunning(3000);

  if (!running) {
    console.log('Starting internal test server on port 3000...');
    serverInstance = startServer(3000);
    // Wait for server to become responsive
    for (let i = 0; i < 20; i++) {
      if (await isServerRunning(3000)) break;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  try {
    // 1. Authoritative Data Suite
    await runScript('verify_authoritative_data.js');

    // 2. System Integrity Suite
    await runScript('verify_system.js');

    // 3. 16-point feature checks
    await runScript('verify_feature_16_points.js');

    // 4. Exact user test cases
    await runScript('verify_user_test_cases.js');

    // 5. E2E HTTP Suite
    await runScript('e2e_http_test.js');

    // Restore clean baseline
    restoreCleanBaseline();

    // Final authoritative re-check
    await runScript('verify_authoritative_data.js');

    console.log('\n========================================================================');
    console.log('  🎉 ALL TEST SUITES PASSED PERFECTLY (100% SUCCESSFUL)');
    console.log('  CLEAN AUTHORITATIVE BASELINE RESTORED');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err.message);
    restoreCleanBaseline();
    process.exitCode = 1;
  } finally {
    if (serverInstance) {
      console.log('Closing internal test server...');
      serverInstance.close();
    }
  }
}

main();
