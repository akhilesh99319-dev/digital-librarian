/* =========================================
   RETURN BOOK MANAGEMENT
   LIBRARY MANAGEMENT SYSTEM

   Connected With:
   lms-data.js
========================================= */


/* =========================================
   CONFIGURATION
========================================= */

const FINE_PER_DAY = 5;


/* =========================================
   DOM ELEMENTS
========================================= */

let returnSearch;
let returnTableBody;


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* -------------------------------
           GET DOM ELEMENTS
        -------------------------------- */

        returnSearch =
            document.getElementById(
                "returnSearch"
            );


        returnTableBody =
            document.getElementById(
                "returnTableBody"
            );


        /* -------------------------------
           INITIAL LOAD
        -------------------------------- */

        displayReturnRecords();

        updateStatistics();


        /* -------------------------------
           SEARCH EVENT
        -------------------------------- */

        if (returnSearch) {

            returnSearch.addEventListener(
                "input",
                displayReturnRecords
            );

        }

    }
);


/* =========================================
   DISPLAY RETURN RECORDS
========================================= */

function displayReturnRecords() {

    if (!returnTableBody) {

        return;

    }


    /* -------------------------------
       GET CENTRAL TRANSACTIONS
    -------------------------------- */

    const transactions =
        getTransactions();


    /* -------------------------------
       SEARCH TEXT
    -------------------------------- */

    const searchText =
        returnSearch
            ? returnSearch.value
                .toLowerCase()
                .trim()
            : "";


    /* -------------------------------
       ACTIVE + RETURNED RECORDS
    -------------------------------- */

    const filteredRecords =
        transactions.filter(
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


    /* -------------------------------
       CLEAR TABLE
    -------------------------------- */

    returnTableBody.innerHTML = "";


    /* -------------------------------
       NO RECORDS
    -------------------------------- */

    if (
        filteredRecords.length === 0
    ) {

        returnTableBody.innerHTML = `

            <tr>

                <td colspan="9">

                    <div class="return-empty-state">

                        <div class="return-empty-state-icon">
                            🔍
                        </div>

                        <h3>
                            No Transaction Records Found
                        </h3>

                        <p>
                            No matching book transactions were found.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    /* -------------------------------
       DISPLAY RECORDS
    -------------------------------- */

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
                getTransactionStatus(
                    record
                );


            const fine =
                calculateFine(
                    record
                );


            const statusClass =
                getStatusClass(
                    status
                );


            const statusText =
                getStatusText(
                    status
                );


            const fineClass =
                fine > 0
                    ? "fine-warning"
                    : "fine-normal";


            const row =
                document.createElement(
                    "tr"
                );


            row.innerHTML = `

                <!-- TRANSACTION ID -->

                <td>

                    <strong>

                        ${escapeHTML(
                            record.id
                        )}

                    </strong>

                </td>


                <!-- BOOK -->

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


                <!-- MEMBER -->

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


                <!-- ISSUE DATE -->

                <td>

                    ${formatDate(
                        record.issueDate
                    )}

                </td>


                <!-- DUE DATE -->

                <td>

                    ${formatDate(
                        record.dueDate
                    )}

                </td>


                <!-- RETURN DATE -->

                <td>

                    ${
                        record.returnDate
                            ? formatDate(
                                record.returnDate
                            )
                            : "-"
                    }

                </td>


                <!-- FINE -->

                <td>

                    <span
                        class="${fineClass}"
                    >

                        ₹${fine}

                    </span>

                </td>


                <!-- STATUS -->

                <td>

                    <span
                        class="
                            return-status
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
                                class="returned-button"
                                disabled
                            >

                                ✓ Returned

                            </button>
                        `

                        :

                        `
                            <button
                                type="button"
                                class="return-action-button"
                                onclick="
                                    returnBook(
                                        '${escapeAttribute(
                                            record.id
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


            returnTableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================
   GET TRANSACTION STATUS
========================================= */

function getTransactionStatus(
    record
) {

    /* -------------------------------
       ALREADY RETURNED
    -------------------------------- */

    if (
        record.status ===
        "returned"
    ) {

        return "returned";

    }


    /* -------------------------------
       CHECK DUE DATE
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
            record.dueDate
        );


    dueDate.setHours(
        0,
        0,
        0,
        0
    );


    /* -------------------------------
       OVERDUE
    -------------------------------- */

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

function calculateFine(
    record
) {

    /* -------------------------------
       RETURNED BOOK
       Use saved fine
    -------------------------------- */

    if (
        record.status ===
        "returned"
    ) {

        return Number(
            record.fine || 0
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


    /* -------------------------------
       DUE DATE
    -------------------------------- */

    const dueDate =
        new Date(
            record.dueDate
        );


    dueDate.setHours(
        0,
        0,
        0,
        0
    );


    /* -------------------------------
       NOT OVERDUE
    -------------------------------- */

    if (
        today <= dueDate
    ) {

        return 0;

    }


    /* -------------------------------
       OVERDUE DAYS
    -------------------------------- */

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


    /* -------------------------------
       FINAL FINE
    -------------------------------- */

    return (
        overdueDays *
        FINE_PER_DAY
    );

}


/* =========================================
   RETURN BOOK
========================================= */

window.returnBook =
function (transactionId) {

    /* -------------------------------
       GET TRANSACTIONS
    -------------------------------- */

    const transactions =
        getTransactions();


    /* -------------------------------
       FIND TRANSACTION
    -------------------------------- */

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


    /* -------------------------------
       TRANSACTION NOT FOUND
    -------------------------------- */

    if (!transaction) {

        alert(
            "Transaction not found."
        );

        return;

    }


    /* -------------------------------
       ALREADY RETURNED
    -------------------------------- */

    if (
        transaction.status ===
        "returned"
    ) {

        alert(
            "This book has already been returned."
        );

        return;

    }


    /* -------------------------------
       GET BOOK
    -------------------------------- */

    const book =
        getBook(
            transaction.bookId
        );


    /* -------------------------------
       CALCULATE FINE
    -------------------------------- */

    const fine =
        calculateFine(
            transaction
        );


    /* -------------------------------
       CONFIRMATION MESSAGE
    -------------------------------- */

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
       RETURN DATE
    ================================= */

    const returnDate =
        getToday();


    /* =================================
       UPDATE TRANSACTION
    ================================= */

    transaction.returnDate =
        returnDate;


    transaction.fine =
        fine;


    transaction.status =
        "returned";


    /* =================================
       SAVE TRANSACTIONS
    ================================= */

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


            /*
               Increase available copies
               but never exceed total quantity
            */

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


    /* =================================
       SUCCESS MESSAGE
    ================================= */

    if (fine > 0) {

        alert(
            `Book returned successfully.\n\nFine: ₹${fine}`
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

    displayReturnRecords();

    updateStatistics();

};


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics() {

    const transactions =
        getTransactions();


    let issued =
        0;


    let overdue =
        0;


    let returned =
        0;


    let totalFine =
        0;


    transactions.forEach(
        function (record) {

            const status =
                getTransactionStatus(
                    record
                );


            /* ISSUED */

            if (
                status === "issued"
            ) {

                issued++;

            }


            /* OVERDUE */

            if (
                status === "overdue"
            ) {

                overdue++;

            }


            /* RETURNED */

            if (
                status === "returned"
            ) {

                returned++;

            }


            /* FINE */

            totalFine +=
                calculateFine(
                    record
                );

        }
    );


    /* -------------------------------
       UPDATE DOM
    -------------------------------- */

    const issuedCount =
        document.getElementById(
            "issuedCount"
        );


    const overdueCount =
        document.getElementById(
            "overdueCount"
        );


    const returnedCount =
        document.getElementById(
            "returnedCount"
        );


    const totalFineElement =
        document.getElementById(
            "totalFine"
        );


    if (issuedCount) {

        issuedCount.textContent =
            issued;

    }


    if (overdueCount) {

        overdueCount.textContent =
            overdue;

    }


    if (returnedCount) {

        returnedCount.textContent =
            returned;

    }


    if (totalFineElement) {

        totalFineElement.textContent =
            `₹${totalFine}`;

    }

}


/* =========================================
   FORMAT DISPLAY DATE
========================================= */

function formatDate(
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
   SECURITY HELPER
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