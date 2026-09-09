/* =========================================
   EDIT BOOK MANAGEMENT
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
           GET FORM
        ================================= */

        const editBookForm =
            document.getElementById(
                "editBookForm"
            );


        if (!editBookForm) {

            console.error(
                "Edit Book Form not found!"
            );

            return;

        }


        /* =================================
           GET BOOK ID FROM URL

           Example:
           edit-book.html?id=B001
        ================================= */

        const urlParams =
            new URLSearchParams(
                window.location.search
            );


        const bookId =
            urlParams.get("id");


        /* =================================
           CHECK BOOK ID
        ================================= */

        if (!bookId) {

            showMessage(
                "Book ID is missing!",
                "error"
            );

            return;

        }


        /* =================================
           LOAD BOOK FROM CENTRAL STORAGE
        ================================= */

        loadBookDetails(
            bookId
        );


        /* =================================
           FORM SUBMIT
        ================================= */

        editBookForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                updateBook(
                    bookId
                );

            }
        );

    }
);


/* =========================================
   LOAD BOOK DETAILS
   FROM LMS CENTRAL DATA
========================================= */

function loadBookDetails(
    bookId
) {

    /* =================================
       GET BOOK FROM CENTRAL STORAGE
    ================================= */

    const book =
        getBook(
            bookId
        );


    /* =================================
       BOOK NOT FOUND
    ================================= */

    if (!book) {

        showMessage(
            "Book not found!",
            "error"
        );

        return;

    }


    /* =================================
       FILL FORM
    ================================= */

    setValue(
        "bookId",
        book.id
    );


    setValue(
        "bookTitle",
        book.title
    );


    setValue(
        "author",
        book.author
    );


    setValue(
        "category",
        book.category
    );


    setValue(
        "isbn",
        book.isbn
    );


    setValue(
        "publisher",
        book.publisher
    );


    setValue(
        "publicationYear",
        book.year
    );


    setValue(
        "quantity",
        book.quantity
    );


    setValue(
        "availableCopies",
        book.available
    );


    setValue(
        "location",
        book.location
    );


    setValue(
        "description",
        book.description
    );


    /* =================================
       PAGE TITLE
    ================================= */

    document.title =
        "Edit " +
        book.title +
        " | Library Management System";


    /* =================================
       DISPLAY CURRENT STOCK INFO
    ================================= */

    updateStockMessage(
        book
    );

}


/* =========================================
   SET INPUT VALUE
========================================= */

function setValue(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.value =
            value ?? "";

    }

}


/* =========================================
   GET INPUT VALUE
========================================= */

function getValue(
    id
) {

    const element =
        document.getElementById(
            id
        );


    if (!element) {

        return "";

    }


    return element.value.trim();

}


/* =========================================
   UPDATE BOOK
========================================= */

function updateBook(
    bookId
) {

    /* =================================
       GET FORM VALUES
    ================================= */

    const title =
        getValue(
            "bookTitle"
        );


    const author =
        getValue(
            "author"
        );


    const category =
        getValue(
            "category"
        );


    const isbn =
        getValue(
            "isbn"
        );


    const publisher =
        getValue(
            "publisher"
        );


    const publicationYear =
        getValue(
            "publicationYear"
        );


    const quantityValue =
        getValue(
            "quantity"
        );


    const availableValue =
        getValue(
            "availableCopies"
        );


    const location =
        getValue(
            "location"
        );


    const description =
        getValue(
            "description"
        );


    /* =================================
       VALIDATION
    ================================= */

    if (!title) {

        showMessage(
            "Please enter book title.",
            "error"
        );

        return;

    }


    if (!author) {

        showMessage(
            "Please enter author name.",
            "error"
        );

        return;

    }


    if (!category) {

        showMessage(
            "Please select a category.",
            "error"
        );

        return;

    }


    if (!isbn) {

        showMessage(
            "Please enter ISBN.",
            "error"
        );

        return;

    }


    /* =================================
       QUANTITY VALIDATION
    ================================= */

    const quantity =
        Number(
            quantityValue
        );


    if (
        !Number.isInteger(quantity) ||
        quantity < 1
    ) {

        showMessage(
            "Total quantity must be a valid number greater than 0.",
            "error"
        );

        return;

    }


    /* =================================
       AVAILABLE VALIDATION
    ================================= */

    const available =
        Number(
            availableValue
        );


    if (
        availableValue === "" ||
        !Number.isInteger(available) ||
        available < 0
    ) {

        showMessage(
            "Available copies must be a valid number.",
            "error"
        );

        return;

    }


    if (
        available > quantity
    ) {

        showMessage(
            "Available copies cannot be greater than total quantity.",
            "error"
        );

        return;

    }


    /* =================================
       GET CENTRAL BOOK DATA
    ================================= */

    const books =
        getBooks();


    const bookIndex =
        books.findIndex(
            function (book) {

                return String(
                    book.id
                ) === String(
                    bookId
                );

            }
        );


    /* =================================
       BOOK NOT FOUND
    ================================= */

    if (
        bookIndex === -1
    ) {

        showMessage(
            "Book not found in central storage.",
            "error"
        );

        return;

    }


    /* =================================
       EXISTING BOOK
    ================================= */

    const existingBook =
        books[bookIndex];


    /* =================================
       CHECK ISSUED COPIES
       
       issued =
       quantity - available
    ================================= */

    const issuedCopies =
        Math.max(
            Number(
                existingBook.quantity || 0
            ) -
            Number(
                existingBook.available || 0
            ),
            0
        );


    /* =================================
       IMPORTANT STOCK RULE

       New quantity cannot be less
       than already issued copies.
    ================================= */

    if (
        quantity < issuedCopies
    ) {

        showMessage(
            `Quantity cannot be less than currently issued copies (${issuedCopies}).`,
            "error"
        );

        return;

    }


    /* =================================
       AVAILABLE + ISSUED VALIDATION
    ================================= */

    if (
        available + issuedCopies >
        quantity
    ) {

        showMessage(
            "Available copies and issued copies exceed total quantity.",
            "error"
        );

        return;

    }


    /* =================================
       CREATE UPDATED BOOK
    ================================= */

    books[bookIndex] = {

        ...existingBook,

        id:
            existingBook.id,

        title:
            title,

        author:
            author,

        category:
            category,

        isbn:
            isbn,

        publisher:
            publisher,

        year:
            publicationYear,

        quantity:
            quantity,

        available:
            available,

        location:
            location,

        description:
            description

    };


    /* =================================
       SAVE TO CENTRAL STORAGE
    ================================= */

    saveBooks(
        books
    );


    /* =================================
       SUCCESS MESSAGE
    ================================= */

    showMessage(
        "Book updated successfully!",
        "success"
    );


    /* =================================
       REDIRECT TO BOOKS PAGE
    ================================= */

    setTimeout(
        function () {

            window.location.href =
                "books.html";

        },
        1000
    );

}


/* =========================================
   STOCK INFORMATION MESSAGE
========================================= */

function updateStockMessage(
    book
) {

    const existingMessage =
        document.getElementById(
            "editStockInfo"
        );


    if (!existingMessage) {

        return;

    }


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


    existingMessage.textContent =
        `Total: ${quantity} | Available: ${available} | Issued: ${issued}`;

}


/* =========================================
   SHOW MESSAGE
========================================= */

function showMessage(
    message,
    type
) {

    let messageBox =
        document.getElementById(
            "formMessage"
        );


    /* =================================
       CREATE MESSAGE BOX
    ================================= */

    if (!messageBox) {

        messageBox =
            document.createElement(
                "div"
            );


        messageBox.id =
            "formMessage";


        messageBox.className =
            "form-message";


        const form =
            document.getElementById(
                "editBookForm"
            );


        if (form) {

            form.prepend(
                messageBox
            );

        }
        else {

            document.body.prepend(
                messageBox
            );

        }

    }


    /* =================================
       SET MESSAGE
    ================================= */

    messageBox.textContent =
        message;


    messageBox.className =
        "form-message " +
        type;


    messageBox.classList.remove(
        "hide"
    );


    /* =================================
       AUTO HIDE
    ================================= */

    setTimeout(
        function () {

            messageBox.classList.add(
                "hide"
            );

        },
        3000
    );

}