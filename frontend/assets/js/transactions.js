/* =========================================
   LMS TRANSACTION MANAGEMENT
   Library Management System

   Connected With:
   lms-data.js
========================================= */


/* =========================================
   DOM ELEMENTS
========================================= */

let transactionSearch;
let transactionStatusFilter;
let transactionTableBody;


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        transactionSearch =
            document.getElementById(
                "transactionSearch"
            );


        transactionStatusFilter =
            document.getElementById(
                "transactionStatusFilter"
            );


        transactionTableBody =
            document.getElementById(
                "transactionTableBody"
            );


        /* -------------------------------
           INITIAL LOAD
        -------------------------------- */

        displayTransactions();

        updateTransactionStatistics();


        /* -------------------------------
           SEARCH
        -------------------------------- */

        if (transactionSearch) {

            transactionSearch.addEventListener(
                "input",
                displayTransactions
            );

        }


        /* -------------------------------
           STATUS FILTER
        -------------------------------- */

        if (transactionStatusFilter) {

            transactionStatusFilter.addEventListener(
                "change",
                displayTransactions
            );

        }

    }
);


/* =========================================
   DISPLAY TRANSACTIONS
========================================= */

function displayTransactions() {

    if (!transactionTableBody) {

        return;

    }


    const transactions =
        getTransactions();


    const searchText =
        transactionSearch
            ? transactionSearch.value
                .toLowerCase()
                .trim()
            : "";


    const selectedStatus =
        transactionStatusFilter
            ? transactionStatusFilter.value
            : "all";


    /* =====================================
       FILTER TRANSACTIONS
    ===================================== */

    const filteredTransactions =
        transactions.filter(
            function (transaction) {

                const book =
                    getBook(
                        transaction.bookId
                    );


                const member =
                    getMember(
                        transaction.memberId
                    );


                const bookTitle =
                    book
                        ? book.title
                            .toLowerCase()
                        : String(
                            transaction.bookTitle || ""
                        ).toLowerCase();


                const memberName =
                    member
                        ? member.name
                            .toLowerCase()
                        : String(
                            transaction.memberName || ""
                        ).toLowerCase();


                const transactionId =
                    String(
                        transaction.id || ""
                    ).toLowerCase();


                const bookId =
                    String(
                        transaction.bookId || ""
                    ).toLowerCase();


                const memberId =
                    String(
                        transaction.memberId || ""
                    ).toLowerCase();


                /* -------------------------------
                   SEARCH MATCH
                -------------------------------- */

                const matchesSearch =

                    transactionId
                        .includes(searchText)

                    ||

                    bookId
                        .includes(searchText)

                    ||

                    bookTitle
                        .includes(searchText)

                    ||

                    memberId
                        .includes(searchText)

                    ||

                    memberName
                        .includes(searchText);


                /* -------------------------------
                   STATUS MATCH
                -------------------------------- */

                const currentStatus =
                    getTransactionStatus(
                        transaction
                    );


                const matchesStatus =

                    selectedStatus === "all"

                    ||

                    selectedStatus ===
                        currentStatus;


                return (
                    matchesSearch &&
                    matchesStatus
                );

            }
        );


    /* =====================================
       CLEAR TABLE
    ===================================== */

    transactionTableBody.innerHTML = "";


    /* =====================================
       NO RECORDS
    ===================================== */

    if (
        filteredTransactions.length === 0
    ) {

        transactionTableBody.innerHTML = `

            <tr>

                <td colspan="9">

                    <div class="transaction-empty-state">

                        <div class="transaction-empty-icon">
                            🔍
                        </div>

                        <h3>
                            No Transactions Found
                        </h3>

                        <p>
                            No matching transaction records were found.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    /* =====================================
       DISPLAY ROWS
    ===================================== */

    filteredTransactions.forEach(
        function (transaction) {

            const book =
                getBook(
                    transaction.bookId
                );


            const member =
                getMember(
                    transaction.memberId
                );


            const status =
                getTransactionStatus(
                    transaction
                );


            const statusClass =
                getStatusClass(
                    status
                );


            const statusText =
                getStatusText(
                    status
                );


            const fine =
                calculateTransactionFine(
                    transaction
                );


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <!-- TRANSACTION ID -->

                <td>

                    <strong>

                        ${escapeHTML(
                            transaction.id
                        )}

                    </strong>

                </td>


                <!-- BOOK -->

                <td>

                    <strong>

                        ${escapeHTML(
                            book
                                ? book.title
                                : transaction.bookTitle
                        )}

                    </strong>

                    <br>

                    <small>

                        ${escapeHTML(
                            transaction.bookId
                        )}

                    </small>

                </td>


                <!-- MEMBER -->

                <td>

                    ${escapeHTML(
                        member
                            ? member.name
                            : transaction.memberName
                    )}

                    <br>

                    <small>

                        ${escapeHTML(
                            transaction.memberId
                        )}

                    </small>

                </td>


                <!-- ISSUE DATE -->

                <td>

                    ${formatTransactionDate(
                        transaction.issueDate
                    )}

                </td>


                <!-- DUE DATE -->

                <td>

                    ${formatTransactionDate(
                        transaction.dueDate
                    )}

                </td>


                <!-- RETURN DATE -->

                <td>

                    ${
                        transaction.returnDate

                        ?

                        formatTransactionDate(
                            transaction.returnDate
                        )

                        :

                        "-"
                    }

                </td>


                <!-- FINE -->

                <td>

                    <span
                        class="
                            ${
                                fine > 0
                                    ? "fine-warning"
                                    : "fine-normal"
                            }
                        "
                    >

                        ₹${fine}

                    </span>

                </td>


                <!-- STATUS -->

                <td>

                    <span
                        class="
                            transaction-status
                            ${statusClass}
                        "
                    >

                        ${statusText}

                    </span>

                </td>


                <!-- ACTION -->

                <td>

                    ${
                        status === "returned"

                        ?

                        `
                            <button
                                type="button"
                                class="transaction-view-button"
                                onclick="
                                    viewTransaction(
                                        '${escapeAttribute(
                                            transaction.id
                                        )}'
                                    )
                                "
                            >

                                View

                            </button>
                        `

                        :

                        `
                            <button
                                type="button"
                                class="transaction-return-button"
                                onclick="
                                    returnTransaction(
                                        '${escapeAttribute(
                                            transaction.id
                                        )}'
                                    )
                                "
                            >

                                ↩ Return

                            </button>
                        `
                    }

                </td>

            `;


            transactionTableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================
   GET TRANSACTION STATUS
========================================= */

function getTransactionStatus(
    transaction
) {

    /* -------------------------------
       RETURNED
    -------------------------------- */

    if (
        transaction.status ===
        "returned"
    ) {

        return "returned";

    }


    /* -------------------------------
       DATE CHECK
    -------------------------------- */

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
        dueDate < today
    ) {

        return "overdue";

    }


    return "issued";

}


/* =========================================
   STATUS CLASS
========================================= */

function getStatusClass(
    status
) {

    if (
        status === "returned"
    ) {

        return "status-returned";

    }


    if (
        status === "overdue"
    ) {

        return "status-overdue";

    }


    return "status-issued";

}


/* =========================================
   STATUS TEXT
========================================= */

function getStatusText(
    status
) {

    if (
        status === "returned"
    ) {

        return "Returned";

    }


    if (
        status === "overdue"
    ) {

        return "Overdue";

    }


    return "Issued";

}


/* =========================================
   CALCULATE FINE
========================================= */

function calculateTransactionFine(
    transaction
) {

    const FINE_PER_DAY =
        5;


    /* -------------------------------
       RETURNED
    -------------------------------- */

    if (
        transaction.status ===
        "returned"
    ) {

        return Number(
            transaction.fine || 0
        );

    }


    /* -------------------------------
       CURRENT DATE
    -------------------------------- */

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
   RETURN TRANSACTION
========================================= */

window.returnTransaction =
function (transactionId) {

    const transactions =
        getTransactions();


    const transaction =
        transactions.find(
            function (item) {

                return String(
                    item.id
                ) === String(
                    transactionId
                );

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
            "This transaction has already been returned."
        );

        return;

    }


    const book =
        getBook(
            transaction.bookId
        );


    const fine =
        calculateTransactionFine(
            transaction
        );


    let message =
        `Return "${

            book
                ? book.title
                : transaction.bookTitle

        }"?`;


    if (fine > 0) {

        message +=
            `\n\nOverdue Fine: ₹${fine}`;

    }


    const confirmed =
        confirm(
            message
        );


    if (!confirmed) {

        return;

    }


    /* =================================
       UPDATE TRANSACTION
    ================================= */

    transaction.returnDate =
        getToday();


    transaction.fine =
        fine;


    transaction.status =
        "returned";


    saveTransactions(
        transactions
    );


    /* =================================
       UPDATE BOOK STOCK
    ================================= */

    if (book) {

        const books =
            getBooks();


        const bookIndex =
            books.findIndex(
                function (item) {

                    return String(
                        item.id
                    ) === String(
                        book.id
                    );

                }
            );


        if (
            bookIndex !== -1
        ) {

            const quantity =
                Number(
                    books[
                        bookIndex
                    ].quantity || 0
                );


            const available =
                Number(
                    books[
                        bookIndex
                    ].available || 0
                );


            books[
                bookIndex
            ].available =
                Math.min(
                    available + 1,
                    quantity
                );


            saveBooks(
                books
            );

        }

    }


    alert(
        fine > 0

            ? `Book returned successfully.\nFine: ₹${fine}`

            : "Book returned successfully."
    );


    displayTransactions();

    updateTransactionStatistics();

};


/* =========================================
   VIEW TRANSACTION
========================================= */

window.viewTransaction =
function (transactionId) {

    const transactions =
        getTransactions();


    const transaction =
        transactions.find(
            function (item) {

                return String(
                    item.id
                ) === String(
                    transactionId
                );

            }
        );


    if (!transaction) {

        alert(
            "Transaction not found."
        );

        return;

    }


    const book =
        getBook(
            transaction.bookId
        );


    const member =
        getMember(
            transaction.memberId
        );


    const status =
        getTransactionStatus(
            transaction
        );


    const fine =
        calculateTransactionFine(
            transaction
        );


    const message =

        `Transaction Details\n\n` +

        `Transaction ID: ${transaction.id}\n` +

        `Book: ${
            book
                ? book.title
                : transaction.bookTitle
        }\n` +

        `Member: ${
            member
                ? member.name
                : transaction.memberName
        }\n` +

        `Issue Date: ${
            transaction.issueDate
        }\n` +

        `Due Date: ${
            transaction.dueDate
        }\n` +

        `Return Date: ${
            transaction.returnDate || "-"
        }\n` +

        `Fine: ₹${fine}\n` +

        `Status: ${
            getStatusText(status)
        }`;


    alert(
        message
    );

};


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateTransactionStatistics() {

    const transactions =
        getTransactions();


    let total =
        transactions.length;


    let issued =
        0;


    let overdue =
        0;


    let returned =
        0;


    let totalFine =
        0;


    transactions.forEach(
        function (transaction) {

            const status =
                getTransactionStatus(
                    transaction
                );


            if (
                status === "issued"
            ) {

                issued++;

            }


            if (
                status === "overdue"
            ) {

                overdue++;

            }


            if (
                status === "returned"
            ) {

                returned++;

            }


            totalFine +=
                calculateTransactionFine(
                    transaction
                );

        }
    );


    /* =================================
       DOM STATISTICS
    ================================= */

    const totalTransactions =
        document.getElementById(
            "totalTransactions"
        );


    const issuedTransactions =
        document.getElementById(
            "issuedTransactions"
        );


    const overdueTransactions =
        document.getElementById(
            "overdueTransactions"
        );


    const returnedTransactions =
        document.getElementById(
            "returnedTransactions"
        );


    const totalFineElement =
        document.getElementById(
            "totalFine"
        );


    if (
        totalTransactions
    ) {

        totalTransactions.textContent =
            total;

    }


    if (
        issuedTransactions
    ) {

        issuedTransactions.textContent =
            issued;

    }


    if (
        overdueTransactions
    ) {

        overdueTransactions.textContent =
            overdue;

    }


    if (
        returnedTransactions
    ) {

        returnedTransactions.textContent =
            returned;

    }


    if (
        totalFineElement
    ) {

        totalFineElement.textContent =
            `₹${totalFine}`;

    }

}


/* =========================================
   FORMAT DATE
========================================= */

function formatTransactionDate(
    dateString
) {

    if (!dateString) {

        return "-";

    }


    const date =
        new Date(
            dateString
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "-";

    }


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
========================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )

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

function escapeAttribute(
    value
) {

    return String(
        value ?? ""
    )

        .replace(
            /\\/g,
            "\\\\"
        )

        .replace(
            /'/g,
            "\\'"
        );

}