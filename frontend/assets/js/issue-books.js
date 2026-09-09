/* =========================================
   ISSUE BOOK MANAGEMENT
   LIBRARY MANAGEMENT SYSTEM

   Connected With:
   lms-data.js
========================================= */


/* =========================================
   DOM ELEMENTS
========================================= */

let bookSelect;
let memberSelect;
let issueDate;
let dueDate;
let issueBookForm;
let issueSearch;
let tableBody;
let bookAvailability;


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* -------------------------------
           GET DOM ELEMENTS
        -------------------------------- */

        bookSelect =
            document.getElementById(
                "bookSelect"
            );


        memberSelect =
            document.getElementById(
                "memberSelect"
            );


        issueDate =
            document.getElementById(
                "issueDate"
            );


        dueDate =
            document.getElementById(
                "dueDate"
            );


        issueBookForm =
            document.getElementById(
                "issueBookForm"
            );


        issueSearch =
            document.getElementById(
                "issueSearch"
            );


        tableBody =
            document.getElementById(
                "issuedBooksTableBody"
            );


        bookAvailability =
            document.getElementById(
                "bookAvailability"
            );


        /* -------------------------------
           INITIAL DATA
        -------------------------------- */

        setDefaultDates();

        loadBookOptions();

        loadMemberOptions();

        displayIssueRecords();

        updateStatistics();


        /* -------------------------------
           EVENTS
        -------------------------------- */

        if (bookSelect) {

            bookSelect.addEventListener(
                "change",
                checkBookAvailability
            );

        }


        if (issueBookForm) {

            issueBookForm.addEventListener(
                "submit",
                issueBook
            );

        }


        if (issueSearch) {

            issueSearch.addEventListener(
                "input",
                displayIssueRecords
            );

        }


        /* -------------------------------
           AUTO SELECT BOOK FROM URL
        -------------------------------- */

        loadBookFromURL();

    }
);


/* =========================================
   LOAD BOOK FROM URL
   Example:

   issue-book.html?id=B001
========================================= */

function loadBookFromURL() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const bookId =
        params.get("id");


    if (!bookId || !bookSelect) {

        return;

    }


    const book =
        getBook(bookId);


    if (!book) {

        return;

    }


    /*
       Make sure book is available
    */

    const available =
        Number(
            book.available || 0
        );


    if (available <= 0) {

        return;

    }


    bookSelect.value =
        book.id;


    checkBookAvailability();

}


/* =========================================
   LOAD BOOK OPTIONS
========================================= */

function loadBookOptions() {

    if (!bookSelect) {

        return;

    }


    const books =
        getBooks();


    bookSelect.innerHTML = `

        <option value="">
            -- Select Book --
        </option>

    `;


    books.forEach(
        function (book) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                book.id;


            const available =
                Number(
                    book.available || 0
                );


            option.textContent =
                `${book.id} - ${book.title}`;


            /*
               Disable unavailable books
            */

            if (available <= 0) {

                option.disabled =
                    true;


                option.textContent +=
                    " (Not Available)";

            }


            bookSelect.appendChild(
                option
            );

        }
    );

}


/* =========================================
   LOAD MEMBER OPTIONS
========================================= */

function loadMemberOptions() {

    if (!memberSelect) {

        return;

    }


    const members =
        getMembers();


    memberSelect.innerHTML = `

        <option value="">
            -- Select Member --
        </option>

    `;


    members.forEach(
        function (member) {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                member.id;


            option.textContent =
                `${member.id} - ${member.name}`;


            /*
               Disable inactive member
            */

            if (!member.active) {

                option.disabled =
                    true;


                option.textContent +=
                    " (Inactive)";

            }


            memberSelect.appendChild(
                option
            );

        }
    );

}


/* =========================================
   DEFAULT DATES
========================================= */

function setDefaultDates() {

    if (
        !issueDate ||
        !dueDate
    ) {

        return;

    }


    const today =
        new Date();


    const due =
        new Date();


    due.setDate(
        due.getDate() + 14
    );


    issueDate.value =
        formatInputDate(
            today
        );


    dueDate.value =
        formatInputDate(
            due
        );


    dueDate.min =
        formatInputDate(
            today
        );

}


/* =========================================
   CHECK BOOK AVAILABILITY
========================================= */

function checkBookAvailability() {

    if (!bookAvailability) {

        return;

    }


    const selectedBookId =
        bookSelect
            ? bookSelect.value
            : "";


    if (!selectedBookId) {

        bookAvailability.textContent =
            "Select a book to check availability.";


        bookAvailability.style.color =
            "#64748b";


        return;

    }


    const book =
        getBook(
            selectedBookId
        );


    if (!book) {

        bookAvailability.textContent =
            "Book not found.";


        bookAvailability.style.color =
            "#dc2626";


        return;

    }


    const available =
        Number(
            book.available || 0
        );


    if (available > 0) {

        bookAvailability.textContent =
            `✓ Available — ${available} copy/copies available.`;


        bookAvailability.style.color =
            "#047857";

    }
    else {

        bookAvailability.textContent =
            "✕ This book is currently unavailable.";


        bookAvailability.style.color =
            "#dc2626";

    }

}


/* =========================================
   ISSUE BOOK
========================================= */

function issueBook(event) {

    event.preventDefault();


    /* -------------------------------
       GET FORM VALUES
    -------------------------------- */

    const selectedBookId =
        bookSelect
            ? bookSelect.value
            : "";


    const selectedMemberId =
        memberSelect
            ? memberSelect.value
            : "";


    const selectedIssueDate =
        issueDate
            ? issueDate.value
            : "";


    const selectedDueDate =
        dueDate
            ? dueDate.value
            : "";


    /* -------------------------------
       VALIDATION
    -------------------------------- */

    if (
        !selectedBookId ||
        !selectedMemberId ||
        !selectedIssueDate ||
        !selectedDueDate
    ) {

        alert(
            "Please fill all required fields."
        );

        return;

    }


    if (
        new Date(selectedDueDate) <=
        new Date(selectedIssueDate)
    ) {

        alert(
            "Due date must be after issue date."
        );

        return;

    }


    /* -------------------------------
       GET CENTRAL DATA
    -------------------------------- */

    const book =
        getBook(
            selectedBookId
        );


    const member =
        getMember(
            selectedMemberId
        );


    /* -------------------------------
       CHECK BOOK
    -------------------------------- */

    if (!book) {

        alert(
            "Selected book was not found."
        );

        return;

    }


    /* -------------------------------
       CHECK MEMBER
    -------------------------------- */

    if (!member) {

        alert(
            "Selected member was not found."
        );

        return;

    }


    /* -------------------------------
       CHECK AVAILABILITY
    -------------------------------- */

    const available =
        Number(
            book.available || 0
        );


    if (available <= 0) {

        alert(
            "This book is currently unavailable."
        );

        loadBookOptions();

        return;

    }


    /* -------------------------------
       CHECK MEMBER STATUS
    -------------------------------- */

    if (!member.active) {

        alert(
            "This member is inactive."
        );

        return;

    }


    /* =================================
       CREATE TRANSACTION
    ================================= */

    const transactions =
        getTransactions();


    const transaction = {

        id:
            generateTransactionId(),

        bookId:
            book.id,

        bookTitle:
            book.title,

        memberId:
            member.id,

        memberName:
            member.name,

        issueDate:
            selectedIssueDate,

        dueDate:
            selectedDueDate,

        returnDate:
            "",

        fine:
            0,

        status:
            "issued"

    };


    transactions.push(
        transaction
    );


    /* =================================
       SAVE TRANSACTION
    ================================= */

    saveTransactions(
        transactions
    );


    /* =================================
       UPDATE BOOK STOCK
    ================================= */

    const books =
        getBooks();


    const bookIndex =
        books.findIndex(
            function (item) {

                return String(item.id) ===
                    String(book.id);

            }
        );


    if (bookIndex !== -1) {

        books[bookIndex].available =
            Math.max(
                Number(
                    books[bookIndex].available || 0
                ) - 1,
                0
            );


        saveBooks(
            books
        );

    }


    /* =================================
       SUCCESS
    ================================= */

    alert(
        `Book "${book.title}" issued successfully.\n\nTransaction ID: ${transaction.id}`
    );


    /* =================================
       RESET FORM
    ================================= */

    if (issueBookForm) {

        issueBookForm.reset();

    }


    setDefaultDates();


    /* =================================
       REFRESH UI
    ================================= */

    loadBookOptions();

    loadMemberOptions();

    displayIssueRecords();

    updateStatistics();


    if (bookAvailability) {

        bookAvailability.textContent =
            "Select a book to check availability.";


        bookAvailability.style.color =
            "#64748b";

    }

}


/* =========================================
   DISPLAY ISSUE RECORDS
========================================= */

function displayIssueRecords() {

    if (!tableBody) {

        return;

    }


    const transactions =
        getTransactions();


    const searchText =
        issueSearch
            ? issueSearch.value
                .toLowerCase()
                .trim()
            : "";


    /*
       Show issued + overdue transactions.
       Returned transactions are not shown
       in active issue table.
    */

    const activeTransactions =
        transactions.filter(
            function (transaction) {

                return (
                    transaction.status !==
                    "returned"
                );

            }
        );


    const filteredRecords =
        activeTransactions.filter(
            function (record) {

                const book =
                    getBook(
                        record.bookId
                    );


                const member =
                    getMember(
                        record.memberId
                    );


                const bookTitle =
                    book
                        ? book.title
                            .toLowerCase()
                        : String(
                            record.bookTitle || ""
                        ).toLowerCase();


                const memberName =
                    member
                        ? member.name
                            .toLowerCase()
                        : String(
                            record.memberName || ""
                        ).toLowerCase();


                return (

                    String(record.id)
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    String(record.bookId)
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    bookTitle
                        .includes(searchText)

                    ||

                    String(record.memberId)
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    memberName
                        .includes(searchText)

                );

            }
        );


    tableBody.innerHTML = "";


    if (
        filteredRecords.length === 0
    ) {

        tableBody.innerHTML = `

            <tr>

                <td colspan="7">

                    <div
                        class="issue-empty-state"
                    >

                        <div
                            class="issue-empty-state-icon"
                        >

                            🔍

                        </div>


                        <h3>
                            No Active Issue Records
                        </h3>


                        <p>
                            No matching issued
                            books were found.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    filteredRecords.forEach(
        function (record) {

            const book =
                getBook(
                    record.bookId
                );


            const member =
                getMember(
                    record.memberId
                );


            const status =
                getRecordStatus(
                    record
                );


            let statusClass =
                "status-issued";


            let statusText =
                "Issued";


            if (
                status === "overdue"
            ) {

                statusClass =
                    "status-overdue";

                statusText =
                    "Overdue";

            }


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <td>

                    <strong>
                        ${escapeHTML(
                            record.id
                        )}
                    </strong>

                </td>


                <td>

                    <strong>

                        ${escapeHTML(
                            book
                                ? book.title
                                : record.bookTitle
                        )}

                    </strong>

                    <br>

                    <small>

                        ${escapeHTML(
                            record.bookId
                        )}

                    </small>

                </td>


                <td>

                    ${escapeHTML(
                        member
                            ? member.name
                            : record.memberName
                    )}

                    <br>

                    <small>

                        ${escapeHTML(
                            record.memberId
                        )}

                    </small>

                </td>


                <td>

                    ${formatDate(
                        record.issueDate
                    )}

                </td>


                <td>

                    ${formatDate(
                        record.dueDate
                    )}

                </td>


                <td>

                    <span
                        class="
                            issue-status
                            ${statusClass}
                        "
                    >

                        ${statusText}

                    </span>

                </td>


                <td>

                    <button
                        type="button"
                        class="return-button"
                        onclick="
                            returnIssuedBook(
                                '${escapeAttribute(record.id)}'
                            )
                        "
                    >

                        ↩ Return

                    </button>

                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================
GET RECORD STATUS
========================================= */

function getRecordStatus(record) {

    if (record.status === "returned") {

        return "returned";

    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const due =
        new Date(record.dueDate);


    due.setHours(
        0,
        0,
        0,
        0
    );


    if (due < today) {

        return "overdue";

    }


    return "issued";

}


/* =========================================
RETURN ISSUED BOOK
Connected With LMS Transactions
========================================= */

function returnIssuedBook(transactionId) {

    const transactions =
        getTransactions();


    const transaction =
        transactions.find(
            function (item) {

                return String(item.id) ===
                    String(transactionId);

            }
        );


    if (!transaction) {

        alert(
            "Transaction not found."
        );

        return;

    }


    if (
        transaction.status ===
        "returned"
    ) {

        alert(
            "This book has already been returned."
        );

        return;

    }


    const book =
        getBook(
            transaction.bookId
        );


    const bookTitle =
        book
            ? book.title
            : transaction.bookTitle;


    const confirmation =
        confirm(
            `Return "${bookTitle}"?`
        );


    if (!confirmation) {

        return;

    }


    /* =================================
       UPDATE TRANSACTION
    ================================= */

    transaction.status =
        "returned";


    transaction.returnDate =
        getToday();


    transaction.fine =
        calculateTransactionFine(
            transaction
        );


    saveTransactions(
        transactions
    );


    /* =================================
       UPDATE BOOK STOCK
    ================================= */

    const books =
        getBooks();


    const bookIndex =
        books.findIndex(
            function (item) {

                return String(item.id) ===
                    String(transaction.bookId);

            }
        );


    if (bookIndex !== -1) {

        const quantity =
            Number(
                books[bookIndex].quantity || 0
            );


        const available =
            Number(
                books[bookIndex].available || 0
            );


        books[bookIndex].available =
            Math.min(
                available + 1,
                quantity
            );


        saveBooks(
            books
        );

    }


    /* =================================
       SUCCESS MESSAGE
    ================================= */

    if (transaction.fine > 0) {

        alert(
            `Book returned successfully.\n\nFine: ₹${transaction.fine}`
        );

    }
    else {

        alert(
            "Book returned successfully."
        );

    }


    /* =================================
       REFRESH PAGE DATA
    ================================= */

    loadBookOptions();

    displayIssueRecords();

    updateStatistics();

}


/* =========================================
CALCULATE TRANSACTION FINE
₹5 PER OVERDUE DAY
========================================= */

function calculateTransactionFine(
    transaction
) {

    const FINE_PER_DAY = 5;


    if (
        transaction.status ===
        "returned"
        &&
        transaction.fine
    ) {

        return Number(
            transaction.fine
        );

    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const dueDate =
        new Date(
            transaction.dueDate
        );


    dueDate.setHours(
        0,
        0,
        0,
        0
    );


    if (
        today <= dueDate
    ) {

        return 0;

    }


    const difference =
        today - dueDate;


    const overdueDays =
        Math.ceil(
            difference /
            (
                1000 *
                60 *
                60 *
                24
            )
        );


    return (
        overdueDays *
        FINE_PER_DAY
    );

}


/* =========================================
UPDATE ISSUE PAGE STATISTICS
========================================= */

function updateStatistics() {

    const transactions =
        getTransactions();


    let issued = 0;

    let overdue = 0;

    let returned = 0;


    transactions.forEach(
        function (transaction) {

            const status =
                getRecordStatus(
                    transaction
                );


            if (
                transaction.status ===
                "returned"
            ) {

                returned++;

            }
            else if (
                status ===
                "overdue"
            ) {

                overdue++;

            }
            else {

                issued++;

            }

        }
    );


    const totalBooks =
        getBooks().length;


    const availableBooks =
        getBooks().filter(
            function (book) {

                return Number(
                    book.available || 0
                ) > 0;

            }
        ).length;


    const issuedBooks =
        getBooks().reduce(
            function (total, book) {

                return total +
                    (
                        Number(
                            book.quantity || 0
                        ) -
                        Number(
                            book.available || 0
                        )
                    );

            },
            0
        );


    const activeMembers =
        getMembers().filter(
            function (member) {

                return member.active;

            }
        ).length;


    const totalBooksElement =
        document.getElementById(
            "totalBooks"
        );


    const availableBooksElement =
        document.getElementById(
            "availableBooks"
        );


    const issuedBooksElement =
        document.getElementById(
            "issuedBooks"
        );


    const activeMembersElement =
        document.getElementById(
            "activeMembers"
        );


    const issuedCountElement =
        document.getElementById(
            "issuedCount"
        );


    const overdueCountElement =
        document.getElementById(
            "overdueCount"
        );


    const returnedCountElement =
        document.getElementById(
            "returnedCount"
        );


    if (totalBooksElement) {

        totalBooksElement.textContent =
            totalBooks;

    }


    if (availableBooksElement) {

        availableBooksElement.textContent =
            availableBooks;

    }


    if (issuedBooksElement) {

        issuedBooksElement.textContent =
            issuedBooks;

    }


    if (activeMembersElement) {

        activeMembersElement.textContent =
            activeMembers;

    }


    if (issuedCountElement) {

        issuedCountElement.textContent =
            issued;

    }


    if (overdueCountElement) {

        overdueCountElement.textContent =
            overdue;

    }


    if (returnedCountElement) {

        returnedCountElement.textContent =
            returned;

    }

}


/* =========================================
FORMAT DATE
========================================= */

function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }


    const date =
        new Date(
            dateString
        );


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",

            month: "short",

            year: "numeric"
        }
    );

}


/* =========================================
ESCAPE HTML
SECURITY HELPER
========================================= */

function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================
ESCAPE ATTRIBUTE
========================================= */

function escapeAttribute(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        );

}