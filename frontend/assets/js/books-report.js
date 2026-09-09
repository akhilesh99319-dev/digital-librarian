/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   BOOKS REPORT JAVASCRIPT
========================================= */


/* =========================================
   DOM ELEMENTS
========================================= */

const searchBook = document.getElementById("searchBook");

const categoryFilter = document.getElementById("categoryFilter");

const statusFilter = document.getElementById("statusFilter");

const resetFilterButton =
    document.getElementById("resetFilterButton");

const printReportButton =
    document.getElementById("printReportButton");

const bookReportTableBody =
    document.getElementById("bookReportTableBody");

const recordCount =
    document.getElementById("recordCount");

const noResults =
    document.getElementById("noResults");

const totalBooks =
    document.getElementById("totalBooks");

const availableBooks =
    document.getElementById("availableBooks");

const issuedBooks =
    document.getElementById("issuedBooks");

const availablePercentage =
    document.getElementById("availablePercentage");

const issuedPercentage =
    document.getElementById("issuedPercentage");


/* =========================================
   GET ALL BOOK ROWS
========================================= */

function getBookRows() {

    return Array.from(
        bookReportTableBody.querySelectorAll("tr")
    );

}


/* =========================================
   SEARCH + FILTER BOOKS
========================================= */

function filterBooks() {

    const searchValue =
        searchBook.value
            .trim()
            .toLowerCase();

    const selectedCategory =
        categoryFilter.value
            .toLowerCase();

    const selectedStatus =
        statusFilter.value
            .toLowerCase();


    const rows = getBookRows();

    let visibleCount = 0;


    rows.forEach(function (row) {

        const rowText =
            row.textContent.toLowerCase();

        const rowCategory =
            row.dataset.category
                .toLowerCase();

        const rowStatus =
            row.dataset.status
                .toLowerCase();


        /* Search condition */

        const matchesSearch =
            searchValue === "" ||
            rowText.includes(searchValue);


        /* Category condition */

        const matchesCategory =
            selectedCategory === "all" ||
            rowCategory === selectedCategory;


        /* Status condition */

        const matchesStatus =
            selectedStatus === "all" ||
            rowStatus === selectedStatus;


        /* Final condition */

        if (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
        ) {

            row.style.display = "";

            visibleCount++;

        } else {

            row.style.display = "none";

        }

    });


    /* Update record count */

    updateRecordCount(visibleCount);


    /* Show / hide no result message */

    if (visibleCount === 0) {

        noResults.classList.add("show");

    } else {

        noResults.classList.remove("show");

    }

}


/* =========================================
   UPDATE RECORD COUNT
========================================= */

function updateRecordCount(count) {

    if (count === 1) {

        recordCount.textContent =
            "Showing 1 record";

    } else {

        recordCount.textContent =
            "Showing " + count + " records";

    }

}


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics() {

    const rows = getBookRows();

    let total = 0;

    let available = 0;

    let issued = 0;


    rows.forEach(function (row) {

        total++;


        const status =
            row.dataset.status
                .toLowerCase();


        if (status === "available") {

            available++;

        }


        if (status === "issued") {

            issued++;

        }

    });


    /* Update numbers */

    totalBooks.textContent = total;

    availableBooks.textContent = available;

    issuedBooks.textContent = issued;


    /* Calculate percentages */

    if (total > 0) {

        const availablePercent =
            (available / total) * 100;

        const issuedPercent =
            (issued / total) * 100;


        availablePercentage.textContent =
            availablePercent.toFixed(1) + "%";

        issuedPercentage.textContent =
            issuedPercent.toFixed(1) + "%";

    } else {

        availablePercentage.textContent =
            "0%";

        issuedPercentage.textContent =
            "0%";

    }

}


/* =========================================
   RESET FILTERS
========================================= */

function resetFilters() {

    searchBook.value = "";

    categoryFilter.value = "all";

    statusFilter.value = "all";


    filterBooks();

}


/* =========================================
   PRINT REPORT
========================================= */

function printReport() {

    window.print();

}


/* =========================================
   SEARCH EVENT
========================================= */

searchBook.addEventListener(
    "input",
    filterBooks
);


/* =========================================
   CATEGORY EVENT
========================================= */

categoryFilter.addEventListener(
    "change",
    filterBooks
);


/* =========================================
   STATUS EVENT
========================================= */

statusFilter.addEventListener(
    "change",
    filterBooks
);


/* =========================================
   RESET EVENT
========================================= */

resetFilterButton.addEventListener(
    "click",
    resetFilters
);


/* =========================================
   PRINT EVENT
========================================= */

printReportButton.addEventListener(
    "click",
    printReport
);


/* =========================================
   INITIALIZE REPORT
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateStatistics();

        filterBooks();

    }
);