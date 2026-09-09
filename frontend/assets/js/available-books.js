/* =========================================
   AVAILABLE BOOKS
   Library Management System

   Connected With:
   lms-data.js
========================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================
       DOM ELEMENTS
    ===================================== */

    const booksContainer =
        document.getElementById("availableBooksContainer");

    const searchInput =
        document.getElementById("availableBookSearch");

    const categoryFilter =
        document.getElementById("availableCategoryFilter");

    const totalAvailable =
        document.getElementById("totalAvailableBooks");


    /* =====================================
       LOAD AVAILABLE BOOKS
    ===================================== */

    function loadAvailableBooks() {

        if (!booksContainer) {
            return;
        }


        /*
           Always get fresh data
           from central LMS storage
        */

        const books =
            getBooks();


        /*
           Only books having
           at least 1 available copy
        */

        let availableBooks =
            books.filter(function (book) {

                return Number(
                    book.available || 0
                ) > 0;

            });


        /* =================================
           SEARCH
        ================================= */

        const searchText =
            searchInput
                ? searchInput.value
                    .toLowerCase()
                    .trim()
                : "";


        if (searchText) {

            availableBooks =
                availableBooks.filter(
                    function (book) {

                        return (

                            String(book.title || "")
                                .toLowerCase()
                                .includes(searchText)

                            ||

                            String(book.author || "")
                                .toLowerCase()
                                .includes(searchText)

                            ||

                            String(book.isbn || "")
                                .toLowerCase()
                                .includes(searchText)

                            ||

                            String(book.category || "")
                                .toLowerCase()
                                .includes(searchText)

                        );

                    }
                );

        }


        /* =================================
           CATEGORY FILTER
        ================================= */

        const selectedCategory =
            categoryFilter
                ? categoryFilter.value
                : "all";


        if (
            selectedCategory !== "all"
        ) {

            availableBooks =
                availableBooks.filter(
                    function (book) {

                        return (
                            book.category ===
                            selectedCategory
                        );

                    }
                );

        }


        /* =================================
           UPDATE COUNT
        ================================= */

        if (totalAvailable) {

            const count =
                books.reduce(
                    function (
                        total,
                        book
                    ) {

                        return total +
                            Number(
                                book.available || 0
                            );

                    },
                    0
                );


            totalAvailable.textContent =
                count;

        }


        /* =================================
           CLEAR CONTAINER
        ================================= */

        booksContainer.innerHTML = "";


        /* =================================
           EMPTY STATE
        ================================= */

        if (
            availableBooks.length === 0
        ) {

            booksContainer.innerHTML = `

                <div class="available-empty-state">

                    <div class="available-empty-icon">
                        📚
                    </div>

                    <h3>
                        No Available Books
                    </h3>

                    <p>
                        No books are currently available.
                    </p>

                </div>

            `;

            return;

        }


        /* =================================
           DISPLAY BOOK CARDS
        ================================= */

        availableBooks.forEach(
            function (book) {

                const card =
                    document.createElement(
                        "article"
                    );


                const available =
                    Number(
                        book.available || 0
                    );


                const quantity =
                    Number(
                        book.quantity || 0
                    );


                let statusClass =
                    "available";


                let statusText =
                    "Available";


                if (available <= 2) {

                    statusClass =
                        "limited";

                    statusText =
                        "Limited Availability";

                }


                card.className =
                    "available-book-card";


                card.innerHTML = `

                    <!-- =====================
                         BOOK COVER
                    ====================== -->

                    <div class="available-book-cover">

                        <div class="book-cover-icon">
                            📚
                        </div>

                    </div>


                    <!-- =====================
                         BOOK CONTENT
                    ====================== -->

                    <div class="available-book-content">

                        <span class="available-book-category">

                            ${escapeHTML(
                                book.category
                            )}

                        </span>


                        <h2 class="available-book-title">

                            ${escapeHTML(
                                book.title
                            )}

                        </h2>


                        <p class="available-book-author">

                            By

                            <strong>
                                ${escapeHTML(
                                    book.author
                                )}
                            </strong>

                        </p>


                        <p class="available-book-description">

                            ${escapeHTML(
                                book.description ||
                                "No description available."
                            )}

                        </p>


                        <!-- =====================
                             AVAILABILITY
                        ====================== -->

                        <div class="available-book-stock">

                            <span
                                class="availability-badge ${statusClass}"
                            >

                                ✓ ${statusText}

                            </span>


                            <span class="copy-count">

                                ${available}
                                /
                                ${quantity}
                                copies available

                            </span>

                        </div>


                        <!-- =====================
                             BOOK INFORMATION
                        ====================== -->

                        <div class="available-book-info">

                            <div>

                                <span>
                                    ISBN
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        book.isbn
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Location
                                </span>

                                <strong>
                                    ${escapeHTML(
                                        book.location
                                    )}
                                </strong>

                            </div>

                        </div>


                        <!-- =====================
                             ACTIONS
                        ====================== -->

                        <div class="available-book-actions">

                            <button
                                type="button"
                                class="available-view-btn"
                                onclick="
                                    viewAvailableBook(
                                        '${escapeAttribute(book.id)}'
                                    )
                                "
                            >

                                View Details

                            </button>


                            <button
                                type="button"
                                class="available-issue-btn"
                                onclick="
                                    issueAvailableBook(
                                        '${escapeAttribute(book.id)}'
                                    )
                                "
                            >

                                Issue Book

                            </button>

                        </div>

                    </div>

                `;


                booksContainer.appendChild(
                    card
                );

            }
        );

    }


    /* =====================================
       LOAD CATEGORIES
    ===================================== */

    function loadCategories() {

        if (!categoryFilter) {
            return;
        }


        const books =
            getBooks();


        const categories =
            [
                ...new Set(
                    books
                        .map(function (book) {

                            return book.category;

                        })
                        .filter(Boolean)
                )
            ]
            .sort();


        categoryFilter.innerHTML = `

            <option value="all">
                All Categories
            </option>

        `;


        categories.forEach(
            function (category) {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    category;


                option.textContent =
                    category;


                categoryFilter.appendChild(
                    option
                );

            }
        );

    }


    /* =====================================
       VIEW BOOK DETAILS
    ===================================== */

    window.viewAvailableBook =
        function (bookId) {

            const book =
                getBook(bookId);


            if (!book) {

                alert(
                    "Book not found."
                );

                return;

            }


            window.location.href =
                "book-details.html?id=" +
                encodeURIComponent(
                    book.id
                );

        };


    /* =====================================
       ISSUE BOOK
    ===================================== */

    window.issueAvailableBook =
        function (bookId) {

            const book =
                getBook(bookId);


            if (!book) {

                alert(
                    "Book not found."
                );

                return;

            }


            const available =
                Number(
                    book.available || 0
                );


            if (available <= 0) {

                alert(
                    "This book is currently unavailable."
                );

                loadAvailableBooks();

                return;

            }


            window.location.href =
                "issue-book.html?id=" +
                encodeURIComponent(
                    book.id
                );

        };


    /* =====================================
       SEARCH EVENT
    ===================================== */

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            loadAvailableBooks
        );

    }


    /* =====================================
       CATEGORY EVENT
    ===================================== */

    if (categoryFilter) {

        categoryFilter.addEventListener(
            "change",
            loadAvailableBooks
        );

    }


    /* =====================================
       SECURITY HELPERS
    ===================================== */

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


    function escapeAttribute(value) {

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


    /* =====================================
       INITIAL LOAD
    ===================================== */

    loadCategories();

    loadAvailableBooks();

});