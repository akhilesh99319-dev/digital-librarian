/* =========================================
   BOOK DETAILS PAGE
   LIBRARY MANAGEMENT SYSTEM

   Connected With:
   lms-data.js
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /* =========================================
           GET BOOK ID FROM URL
        ========================================= */

        const urlParams =
            new URLSearchParams(
                window.location.search
            );


        const bookId =
            urlParams.get("id");


        /* =========================================
           CHECK BOOK ID
        ========================================= */

        if (!bookId) {

            showError(
                "Book ID is missing."
            );

            return;
        }


        /* =========================================
           LOAD BOOK DETAILS
        ========================================= */

        loadBookDetails(bookId);


        /* =========================================
           MOBILE MENU
        ========================================= */

        setupMobileMenu();

    }
);


/* =========================================
   LOAD BOOK DETAILS
========================================= */

function loadBookDetails(bookId) {

    /*
       Get book from CENTRAL LMS STORAGE
    */

    const book =
        getBook(bookId);


    /* =========================================
       BOOK NOT FOUND
    ========================================= */

    if (!book) {

        showError(
            "Book not found."
        );

        return;
    }


    /* =========================================
       DISPLAY BOOK
    ========================================= */

    displayBook(book);


    /* =========================================
       UPDATE PAGE TITLE
    ========================================= */

    document.title =
        `${book.title} | Library Management System`;


    /* =========================================
       ISSUE BUTTON
    ========================================= */

    const issueBookBtn =
        document.getElementById(
            "issueBookBtn"
        );


    if (issueBookBtn) {

        /*
           If book is unavailable,
           disable issue action.
        */

        if (
            Number(book.available || 0) <= 0
        ) {

            issueBookBtn.classList.add(
                "disabled"
            );


            issueBookBtn.setAttribute(
                "aria-disabled",
                "true"
            );


            issueBookBtn.textContent =
                "Book Unavailable";


            issueBookBtn.removeAttribute(
                "href"
            );

        }
        else {

            issueBookBtn.href =
                "issue-book.html?id=" +
                encodeURIComponent(
                    book.id
                );

        }

    }


    /* =========================================
       EDIT BUTTON
    ========================================= */

    const editBookBtn =
        document.getElementById(
            "editBookBtn"
        );


    if (editBookBtn) {

        editBookBtn.href =
            "edit-book.html?id=" +
            encodeURIComponent(
                book.id
            );

    }

}


/* =========================================
   DISPLAY BOOK
========================================= */

function displayBook(book) {

    const container =
        document.getElementById(
            "bookDetailsCard"
        );


    if (!container) {

        console.error(
            "Book details container not found."
        );

        return;
    }


    /* =========================================
       STOCK VALUES
    ========================================= */

    const quantity =
        Number(
            book.quantity || 0
        );


    const available =
        Number(
            book.available || 0
        );


    const issued =
        Math.max(
            quantity - available,
            0
        );


    /* =========================================
       AVAILABILITY STATUS
    ========================================= */

    let availabilityClass =
        "available";


    let availabilityText =
        "Available";


    if (available <= 0) {

        availabilityClass =
            "unavailable";


        availabilityText =
            "Not Available";

    }
    else if (available <= 2) {

        availabilityClass =
            "limited";


        availabilityText =
            "Limited Availability";

    }


    /* =========================================
       BOOK DETAILS HTML
    ========================================= */

    container.innerHTML = `

        <div class="book-details-header">

            <div class="book-cover-large">

                <span>
                    📚
                </span>

            </div>


            <div class="book-main-info">

                <span class="book-category">

                    ${escapeHTML(
                        book.category
                    )}

                </span>


                <h1>

                    ${escapeHTML(
                        book.title
                    )}

                </h1>


                <p class="book-author">

                    By

                    <strong>

                        ${escapeHTML(
                            book.author
                        )}

                    </strong>

                </p>


                <span
                    class="
                        book-availability
                        ${availabilityClass}
                    "
                >

                    ${availabilityText}

                </span>

            </div>

        </div>



        <div class="book-description">

            <h2>
                About This Book
            </h2>


            <p>

                ${escapeHTML(
                    book.description ||
                    "No description available."
                )}

            </p>

        </div>



        <div class="book-information">

            <h2>
                Book Information
            </h2>


            <div class="book-info-grid">


                <div class="book-info-item">

                    <span class="info-label">
                        Book ID
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.id
                        )}

                    </strong>

                </div>



                <div class="book-info-item">

                    <span class="info-label">
                        ISBN
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.isbn
                        )}

                    </strong>

                </div>



                <div class="book-info-item">

                    <span class="info-label">
                        Publisher
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.publisher
                        )}

                    </strong>

                </div>



                <div class="book-info-item">

                    <span class="info-label">
                        Publication Year
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.year
                        )}

                    </strong>

                </div>



                <div class="book-info-item">

                    <span class="info-label">
                        Category
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.category
                        )}

                    </strong>

                </div>



                <div class="book-info-item">

                    <span class="info-label">
                        Location
                    </span>


                    <strong>

                        ${escapeHTML(
                            book.location
                        )}

                    </strong>

                </div>

            </div>

        </div>



        <div class="book-stock">

            <h2>
                Stock Information
            </h2>


            <div class="stock-grid">


                <div class="stock-item">

                    <span class="stock-number">

                        ${quantity}

                    </span>


                    <span class="stock-label">

                        Total Copies

                    </span>

                </div>



                <div class="stock-item">

                    <span class="stock-number">

                        ${available}

                    </span>


                    <span class="stock-label">

                        Available

                    </span>

                </div>



                <div class="stock-item">

                    <span class="stock-number">

                        ${issued}

                    </span>


                    <span class="stock-label">

                        Issued

                    </span>

                </div>

            </div>

        </div>

    `;

}


/* =========================================
   ERROR MESSAGE
========================================= */

function showError(message) {

    const container =
        document.getElementById(
            "bookDetailsCard"
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

                The requested book
                could not be found.

            </p>


            <a
                href="books.html"
                class="back-btn"
            >

                ← Back to Books

            </a>

        </div>

    `;

}


/* =========================================
   ESCAPE HTML
========================================= */

function escapeHTML(value) {

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


    /* =========================================
       CLOSE MENU AFTER CLICK
    ========================================= */

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