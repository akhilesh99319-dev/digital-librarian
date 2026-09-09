/* =========================================
   MEMBER DETAILS MANAGEMENT
   LIBRARY MANAGEMENT SYSTEM

   Connected With:
   lms-data.js
========================================= */


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* =================================
           GET MEMBER ID FROM URL
        ================================= */

        const urlParams =
            new URLSearchParams(
                window.location.search
            );


        const memberId =
            urlParams.get("id");


        /* =================================
           CHECK MEMBER ID
        ================================= */

        if (!memberId) {

            showError(
                "Member ID is missing."
            );

            return;

        }


        /* =================================
           LOAD MEMBER
        ================================= */

        loadMemberDetails(
            memberId
        );


        /* =================================
           MOBILE MENU
        ================================= */

        setupMobileMenu();

    }
);


/* =========================================
   LOAD MEMBER DETAILS
========================================= */

function loadMemberDetails(
    memberId
) {

    /* =================================
       GET MEMBER FROM CENTRAL STORAGE
    ================================= */

    const member =
        getMember(
            memberId
        );


    /* =================================
       MEMBER NOT FOUND
    ================================= */

    if (!member) {

        showError(
            "Member not found."
        );

        return;

    }


    /* =================================
       DISPLAY MEMBER
    ================================= */

    displayMember(
        member
    );


    /* =================================
       DISPLAY TRANSACTIONS
    ================================= */

    displayMemberTransactions(
        member
    );


    /* =================================
       DISPLAY CURRENT BORROWED BOOKS
    ================================= */

    displayCurrentBorrowedBooks(
        member
    );


    /* =================================
       UPDATE PAGE TITLE
    ================================= */

    document.title =
        `${member.name} | Member Details | Library Management System`;


    /* =================================
       EDIT BUTTON
    ================================= */

    const editMemberBtn =
        document.getElementById(
            "editMemberBtn"
        );


    if (editMemberBtn) {

        editMemberBtn.onclick =
            function () {

                window.location.href =
                    "edit-member.html?id=" +
                    encodeURIComponent(
                        member.id
                    );

            };

    }

}


/* =========================================
   DISPLAY MEMBER
========================================= */

function displayMember(
    member
) {

    const container =
        document.getElementById(
            "memberDetailsCard"
        );


    if (!container) {

        console.error(
            "Member details container not found."
        );

        return;

    }


    /* =================================
       GET TRANSACTIONS
    ================================= */

    const transactions =
        getTransactions();


    const memberTransactions =
        transactions.filter(
            function (transaction) {

                return String(
                    transaction.memberId
                ) === String(
                    member.id
                );

            }
        );


    const activeTransactions =
        memberTransactions.filter(
            function (transaction) {

                return (
                    transaction.status !==
                    "returned"
                );

            }
        );


    const returnedTransactions =
        memberTransactions.filter(
            function (transaction) {

                return (
                    transaction.status ===
                    "returned"
                );

            }
        );


    /* =================================
       MEMBER STATUS
    ================================= */

    const statusClass =
        member.active
            ? "member-active"
            : "member-inactive";


    const statusText =
        member.active
            ? "Active"
            : "Inactive";


    /* =================================
       DISPLAY
    ================================= */

    container.innerHTML = `

        <div class="member-details-profile">


            <!-- PROFILE ICON -->

            <div class="member-profile-icon">

                👤

            </div>


            <!-- MEMBER BASIC INFO -->

            <div class="member-profile-main">

                <div class="member-profile-heading">

                    <span class="page-label">
                        MEMBER
                    </span>


                    <span
                        class="
                            member-status
                            ${statusClass}
                        "
                    >

                        ${statusText}

                    </span>

                </div>


                <h2>

                    ${escapeHTML(
                        member.name
                    )}

                </h2>


                <p class="member-id">

                    Member ID:
                    <strong>

                        ${escapeHTML(
                            member.id
                        )}

                    </strong>

                </p>

            </div>

        </div>



        <!-- =================================
             MEMBER INFORMATION
        ================================== -->

        <div class="member-information">

            <h2>
                Member Information
            </h2>


            <div class="member-info-grid">


                <div class="member-info-item">

                    <span class="info-label">
                        Full Name
                    </span>

                    <strong>

                        ${escapeHTML(
                            member.name
                        )}

                    </strong>

                </div>



                <div class="member-info-item">

                    <span class="info-label">
                        Email
                    </span>

                    <strong>

                        ${escapeHTML(
                            member.email || "-"
                        )}

                    </strong>

                </div>



                <div class="member-info-item">

                    <span class="info-label">
                        Phone
                    </span>

                    <strong>

                        ${escapeHTML(
                            member.phone || "-"
                        )}

                    </strong>

                </div>



                <div class="member-info-item">

                    <span class="info-label">
                        Membership Date
                    </span>

                    <strong>

                        ${formatMemberDate(
                            member.joinDate
                        )}

                    </strong>

                </div>



                <div class="member-info-item">

                    <span class="info-label">
                        Account Status
                    </span>

                    <strong>

                        ${statusText}

                    </strong>

                </div>



                <div class="member-info-item">

                    <span class="info-label">
                        Member ID
                    </span>

                    <strong>

                        ${escapeHTML(
                            member.id
                        )}

                    </strong>

                </div>

            </div>

        </div>



        <!-- =================================
             MEMBER STATISTICS
        ================================== -->

        <div class="member-detail-statistics">


            <div class="member-detail-stat">

                <span class="stat-icon">
                    📚
                </span>

                <div>

                    <span>
                        Active Issues
                    </span>

                    <strong>

                        ${activeTransactions.length}

                    </strong>

                </div>

            </div>



            <div class="member-detail-stat">

                <span class="stat-icon">
                    🔄
                </span>

                <div>

                    <span>
                        Returned Books
                    </span>

                    <strong>

                        ${returnedTransactions.length}

                    </strong>

                </div>

            </div>



            <div class="member-detail-stat">

                <span class="stat-icon">
                    📋
                </span>

                <div>

                    <span>
                        Total Transactions
                    </span>

                    <strong>

                        ${memberTransactions.length}

                    </strong>

                </div>

            </div>

        </div>

    `;

}


/* =========================================
   DISPLAY CURRENT BORROWED BOOKS
========================================= */

function displayCurrentBorrowedBooks(
    member
) {

    const tableBody =
        document.getElementById(
            "memberBorrowingTableBody"
        );


    const countElement =
        document.getElementById(
            "memberBorrowedCount"
        );


    if (!tableBody) {

        return;

    }


    const transactions =
        getTransactions();


    const activeTransactions =
        transactions.filter(
            function (transaction) {

                return (

                    String(
                        transaction.memberId
                    ) === String(
                        member.id
                    )

                    &&

                    transaction.status !==
                    "returned"

                );

            }
        );


    /* =================================
       UPDATE COUNT
    ================================= */

    if (countElement) {

        countElement.textContent =
            `${activeTransactions.length} ${
                activeTransactions.length === 1
                    ? "Book"
                    : "Books"
            }`;

    }


    /* =================================
       CLEAR TABLE
    ================================= */

    tableBody.innerHTML = "";


    /* =================================
       EMPTY STATE
    ================================= */

    if (
        activeTransactions.length === 0
    ) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="no-members"
                >

                    <div class="members-empty-state">

                        <div class="members-empty-icon">
                            📚
                        </div>

                        <h3>
                            No Active Books
                        </h3>

                        <p>
                            This member currently has
                            no borrowed books.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    /* =================================
       CREATE ROWS
    ================================= */

    activeTransactions.forEach(
        function (transaction) {

            const book =
                getBook(
                    transaction.bookId
                );


            const status =
                getTransactionStatus(
                    transaction
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

                <td>

                    <strong>

                        ${escapeHTML(
                            transaction.id
                        )}

                    </strong>

                </td>


                <td>

                    <strong>

                        ${escapeHTML(
                            book
                                ? book.title
                                : transaction.bookTitle ||
                                  "Unknown Book"
                        )}

                    </strong>

                    <br>

                    <small>

                        ${escapeHTML(
                            transaction.bookId
                        )}

                    </small>

                </td>


                <td>

                    ${formatMemberDate(
                        transaction.issueDate
                    )}

                </td>


                <td>

                    ${formatMemberDate(
                        transaction.dueDate
                    )}

                </td>


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


                <td>

                    <span
                        class="
                            transaction-status
                            ${getStatusClass(
                                status
                            )}
                        "
                    >

                        ${getStatusText(
                            status
                        )}

                    </span>

                </td>


                <td>

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

                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================
   DISPLAY TRANSACTION HISTORY
========================================= */

function displayMemberTransactions(
    member
) {

    const tableBody =
        document.getElementById(
            "memberTransactionTableBody"
        );


    const countElement =
        document.getElementById(
            "memberTransactionCount"
        );


    if (!tableBody) {

        return;

    }


    const transactions =
        getTransactions();


    const memberTransactions =
        transactions.filter(
            function (transaction) {

                return String(
                    transaction.memberId
                ) === String(
                    member.id
                );

            }
        );


    /* =================================
       UPDATE COUNT
    ================================= */

    if (countElement) {

        countElement.textContent =
            `${memberTransactions.length} ${
                memberTransactions.length === 1
                    ? "Transaction"
                    : "Transactions"
            }`;

    }


    /* =================================
       CLEAR TABLE
    ================================= */

    tableBody.innerHTML = "";


    /* =================================
       EMPTY STATE
    ================================= */

    if (
        memberTransactions.length === 0
    ) {

        tableBody.innerHTML = `

            <tr>

                <td
                    colspan="7"
                    class="no-members"
                >

                    <div class="members-empty-state">

                        <div class="members-empty-icon">
                            📋
                        </div>

                        <h3>
                            No Transaction History
                        </h3>

                        <p>
                            This member has no transaction records.
                        </p>

                    </div>

                </td>

            </tr>

        `;

        return;

    }


    /* =================================
       CREATE HISTORY ROWS
    ================================= */

    memberTransactions.forEach(
        function (transaction) {

            const book =
                getBook(
                    transaction.bookId
                );


            const status =
                getTransactionStatus(
                    transaction
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

                <td>

                    <strong>

                        ${escapeHTML(
                            transaction.id
                        )}

                    </strong>

                </td>


                <td>

                    ${escapeHTML(
                        book
                            ? book.title
                            : transaction.bookTitle ||
                              "Unknown Book"
                    )}

                </td>


                <td>

                    ${formatMemberDate(
                        transaction.issueDate
                    )}

                </td>


                <td>

                    ${formatMemberDate(
                        transaction.dueDate
                    )}

                </td>


                <td>

                    ${
                        transaction.returnDate
                            ? formatMemberDate(
                                transaction.returnDate
                            )
                            : "-"
                    }

                </td>


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


                <td>

                    <span
                        class="
                            transaction-status
                            ${getStatusClass(
                                status
                            )}
                        "
                    >

                        ${getStatusText(
                            status
                        )}

                    </span>

                </td>

            `;


            tableBody.appendChild(
                row
            );

        }
    );

}


/* =========================================
   VIEW TRANSACTION
========================================= */

window.viewTransaction =
function (
    transactionId
) {

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

        `Transaction ID: ${
            transaction.id
        }\n` +

        `Book: ${
            book
                ? book.title
                : transaction.bookTitle ||
                  "Unknown Book"
        }\n` +

        `Issue Date: ${
            transaction.issueDate || "-"
        }\n` +

        `Due Date: ${
            transaction.dueDate || "-"
        }\n` +

        `Return Date: ${
            transaction.returnDate || "-"
        }\n` +

        `Fine: ₹${fine}\n` +

        `Status: ${
            getStatusText(
                status
            )
        }`;


    alert(
        message
    );

};


/* =========================================
   TRANSACTION STATUS
========================================= */

function getTransactionStatus(
    transaction
) {

    if (
        transaction.status ===
        "returned"
    ) {

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


    /* =================================
       RETURNED
    ================================= */

    if (
        transaction.status ===
        "returned"
    ) {

        return Number(
            transaction.fine || 0
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
   FORMAT DATE
========================================= */

function formatMemberDate(
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
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"
        }
    );

}


/* =========================================
   ERROR MESSAGE
========================================= */

function showError(
    message
) {

    const container =
        document.getElementById(
            "memberDetailsCard"
        );


    if (!container) {

        return;

    }


    container.innerHTML = `

        <div class="book-error">

            <div class="error-icon">
                ⚠️
            </div>


            <h2>

                ${escapeHTML(
                    message
                )}

            </h2>


            <p>

                The requested member
                could not be found.

            </p>


            <a
                href="members.html"
                class="back-btn"
            >

                ← Back to Members

            </a>

        </div>

    `;


    const borrowingSection =
        document.getElementById(
            "memberBorrowingSection"
        );


    const transactionSection =
        document.getElementById(
            "memberTransactionSection"
        );


    if (borrowingSection) {

        borrowingSection.style.display =
            "none";

    }


    if (transactionSection) {

        transactionSection.style.display =
            "none";

    }

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


/* =========================================
   MOBILE MENU
========================================= */

function setupMobileMenu() {

    const menuButton =
        document.getElementById(
            "mobileMenuBtn"
        );


    const navigation =
        document.querySelector(
            ".dashboard-nav"
        );


    if (
        !menuButton ||
        !navigation
    ) {

        return;

    }


    menuButton.addEventListener(
        "click",
        function () {

            navigation.classList.toggle(
                "active"
            );

        }
    );


    /* =================================
       CLOSE MENU AFTER CLICK
    ================================= */

    const navLinks =
        navigation.querySelectorAll(
            "a"
        );


    navLinks.forEach(
        function (link) {

            link.addEventListener(
                "click",
                function () {

                    navigation.classList.remove(
                        "active"
                    );

                }
            );

        }
    );

}