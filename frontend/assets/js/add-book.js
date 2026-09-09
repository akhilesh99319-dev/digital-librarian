/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   ADD BOOK JAVASCRIPT
========================================= */


/* =========================================
   DOM ELEMENTS
========================================= */

const addBookForm = document.getElementById("addBookForm");

const bookTitle = document.getElementById("bookTitle");
const bookAuthor = document.getElementById("bookAuthor");
const bookISBN = document.getElementById("bookISBN");
const bookCategory = document.getElementById("bookCategory");
const bookLanguage = document.getElementById("bookLanguage");

const bookPublisher = document.getElementById("bookPublisher");
const publicationYear = document.getElementById("publicationYear");
const bookEdition = document.getElementById("bookEdition");
const bookPages = document.getElementById("bookPages");

const bookQuantity = document.getElementById("bookQuantity");
const shelfNumber = document.getElementById("shelfNumber");
const bookStatus = document.getElementById("bookStatus");

const bookDescription =
    document.getElementById("bookDescription");

const descriptionCount =
    document.getElementById("descriptionCount");

const bookCover =
    document.getElementById("bookCover");

const coverPreview =
    document.getElementById("coverPreview");

const bookConfirmation =
    document.getElementById("bookConfirmation");

const resetBookForm =
    document.getElementById("resetBookForm");

const recentBooksTableBody =
    document.getElementById("recentBooksTableBody");


/* =========================================
   LIVE PREVIEW ELEMENTS
========================================= */

const liveBookCover =
    document.getElementById("liveBookCover");

const liveBookTitle =
    document.getElementById("liveBookTitle");

const liveBookAuthor =
    document.getElementById("liveBookAuthor");

const liveBookCategory =
    document.getElementById("liveBookCategory");

const liveBookISBN =
    document.getElementById("liveBookISBN");

const liveBookStatus =
    document.getElementById("liveBookStatus");

const liveBookQuantity =
    document.getElementById("liveBookQuantity");

const liveBookShelf =
    document.getElementById("liveBookShelf");

const liveBookLanguage =
    document.getElementById("liveBookLanguage");


/* =========================================
   ERROR ELEMENTS
========================================= */

const bookTitleError =
    document.getElementById("bookTitleError");

const bookAuthorError =
    document.getElementById("bookAuthorError");

const bookISBNError =
    document.getElementById("bookISBNError");

const bookCategoryError =
    document.getElementById("bookCategoryError");


/* =========================================
   DEFAULT COVER
========================================= */

const defaultCoverHTML = `
    <div class="preview-placeholder">
        📖
    </div>

    <span>
        Cover Preview
    </span>
`;


/* =========================================
   LIVE BOOK PREVIEW
========================================= */

function updateBookPreview() {

    /* BOOK TITLE */

    const title =
        bookTitle.value.trim();

    liveBookTitle.textContent =
        title || "Book Title";


    /* AUTHOR */

    const author =
        bookAuthor.value.trim();

    liveBookAuthor.textContent =
        author || "Author Name";


    /* CATEGORY */

    const category =
        bookCategory.value;

    liveBookCategory.textContent =
        category || "Category";


    /* ISBN */

    const isbn =
        bookISBN.value.trim();

    liveBookISBN.textContent =
        isbn || "ISBN";


    /* QUANTITY */

    const quantity =
        bookQuantity.value;

    liveBookQuantity.textContent =
        quantity || "1";


    /* SHELF */

    const shelf =
        shelfNumber.value.trim();

    liveBookShelf.textContent =
        shelf || "—";


    /* LANGUAGE */

    const language =
        bookLanguage.value;

    liveBookLanguage.textContent =
        language || "English";


    /* STATUS */

    updateStatusPreview();

}


/* =========================================
   STATUS PREVIEW
========================================= */

function updateStatusPreview() {

    const status =
        bookStatus.value;


    liveBookStatus.classList.remove(
        "available",
        "issued",
        "maintenance"
    );


    if (status === "issued") {

        liveBookStatus.textContent =
            "Issued";

        liveBookStatus.classList.add(
            "issued"
        );

    }

    else if (status === "maintenance") {

        liveBookStatus.textContent =
            "Maintenance";

        liveBookStatus.classList.add(
            "maintenance"
        );

    }

    else {

        liveBookStatus.textContent =
            "Available";

        liveBookStatus.classList.add(
            "available"
        );

    }

}


/* =========================================
   DESCRIPTION COUNTER
========================================= */

function updateDescriptionCounter() {

    const length =
        bookDescription.value.length;

    descriptionCount.textContent =
        length;


    if (length >= 900) {

        descriptionCount.style.color =
            "#dc2626";

    }

    else if (length >= 700) {

        descriptionCount.style.color =
            "#d97706";

    }

    else {

        descriptionCount.style.color =
            "";

    }

}


/* =========================================
   IMAGE PREVIEW
========================================= */

function previewCoverImage() {

    const file =
        bookCover.files[0];


    if (!file) {

        coverPreview.innerHTML =
            defaultCoverHTML;

        liveBookCover.innerHTML = `
            <div class="preview-book-icon">
                📖
            </div>

            <span>
                No Cover
            </span>
        `;

        return;

    }


    /* CHECK FILE TYPE */

    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png"
    ];


    if (!allowedTypes.includes(file.type)) {

        alert(
            "Please select a JPG, JPEG or PNG image."
        );

        bookCover.value = "";

        return;

    }


    /* CHECK FILE SIZE */

    const maxSize =
        2 * 1024 * 1024;


    if (file.size > maxSize) {

        alert(
            "Image size should not exceed 2 MB."
        );

        bookCover.value = "";

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function (event) {

            const imageURL =
                event.target.result;


            /* FORM COVER PREVIEW */

            coverPreview.innerHTML = `
                <img
                    src="${imageURL}"
                    alt="Book Cover Preview">

                <span>
                    Cover Preview
                </span>
            `;


            /* LIVE PREVIEW */

            liveBookCover.innerHTML = `
                <img
                    src="${imageURL}"
                    alt="Book Cover">
            `;

        };


    reader.readAsDataURL(file);

}


/* =========================================
   CLEAR ERRORS
========================================= */

function clearErrors() {

    bookTitleError.textContent = "";
    bookAuthorError.textContent = "";
    bookISBNError.textContent = "";
    bookCategoryError.textContent = "";


    bookTitle
        .closest(".form-group")
        .classList.remove("has-error");

    bookAuthor
        .closest(".form-group")
        .classList.remove("has-error");

    bookISBN
        .closest(".form-group")
        .classList.remove("has-error");

    bookCategory
        .closest(".form-group")
        .classList.remove("has-error");

}


/* =========================================
   VALIDATE FORM
========================================= */

function validateForm() {

    clearErrors();


    let isValid = true;


    /* BOOK TITLE */

    if (bookTitle.value.trim().length < 2) {

        bookTitleError.textContent =
            "Please enter a valid book title.";

        bookTitle
            .closest(".form-group")
            .classList.add("has-error");

        isValid = false;

    }


    /* AUTHOR */

    if (bookAuthor.value.trim().length < 2) {

        bookAuthorError.textContent =
            "Please enter a valid author name.";

        bookAuthor
            .closest(".form-group")
            .classList.add("has-error");

        isValid = false;

    }


    /* ISBN */

    const isbn =
        bookISBN.value.trim();


    if (isbn.length < 10) {

        bookISBNError.textContent =
            "Please enter a valid ISBN.";

        bookISBN
            .closest(".form-group")
            .classList.add("has-error");

        isValid = false;

    }


    /* CATEGORY */

    if (bookCategory.value === "") {

        bookCategoryError.textContent =
            "Please select a category.";

        bookCategory
            .closest(".form-group")
            .classList.add("has-error");

        isValid = false;

    }


    return isValid;

}


/* =========================================
   CREATE BOOK ID
========================================= */

function generateBookID() {

    const number =
        Date.now().toString().slice(-5);

    return "BK" + number;

}


/* =========================================
   GET STATUS CLASS
========================================= */

function getStatusClass(status) {

    if (status === "issued") {

        return "issued";

    }

    if (status === "maintenance") {

        return "maintenance";

    }

    return "available";

}


/* =========================================
   GET STATUS TEXT
========================================= */

function getStatusText(status) {

    if (status === "issued") {

        return "Issued";

    }

    if (status === "maintenance") {

        return "Maintenance";

    }

    return "Available";

}


/* =========================================
   ADD BOOK TO RECENT TABLE
========================================= */

function addBookToTable(book) {

    const row =
        document.createElement("tr");


    row.innerHTML = `

        <td>
            ${book.id}
        </td>

        <td>
            ${book.title}
        </td>

        <td>
            ${book.author}
        </td>

        <td>
            ${book.category}
        </td>

        <td>
            ${book.quantity}
        </td>

        <td>

            <span class="book-status ${getStatusClass(book.status)}">

                ${getStatusText(book.status)}

            </span>

        </td>

    `;


    recentBooksTableBody.prepend(row);

}


/* =========================================
   SAVE BOOK TO LOCAL STORAGE
========================================= */

function saveBookToStorage(book) {

    let books = [];


    try {

        books =
            JSON.parse(
                localStorage.getItem("lmsBooks")
            ) || [];

    }

    catch (error) {

        books = [];

    }


    books.push(book);


    localStorage.setItem(
        "lmsBooks",
        JSON.stringify(books)
    );

}


/* =========================================
   LOAD SAVED BOOKS
========================================= */

function loadSavedBooks() {

    let books = [];


    try {

        books =
            JSON.parse(
                localStorage.getItem("lmsBooks")
            ) || [];

    }

    catch (error) {

        books = [];

    }


    books.forEach(function (book) {

        addBookToTable(book);

    });

}


/* =========================================
   FORM SUBMIT
========================================= */

addBookForm.addEventListener(
    "submit",
    function (event) {

        event.preventDefault();


        /* VALIDATE */

        if (!validateForm()) {

            return;

        }


        /* CONFIRMATION */

        if (!bookConfirmation.checked) {

            alert(
                "Please confirm that the entered information is correct."
            );

            return;

        }


        /* CREATE BOOK OBJECT */

        const newBook = {

            id: generateBookID(),

            title:
                bookTitle.value.trim(),

            author:
                bookAuthor.value.trim(),

            isbn:
                bookISBN.value.trim(),

            category:
                bookCategory.value,

            language:
                bookLanguage.value,

            publisher:
                bookPublisher.value.trim(),

            publicationYear:
                publicationYear.value,

            edition:
                bookEdition.value.trim(),

            pages:
                bookPages.value,

            quantity:
                bookQuantity.value,

            shelf:
                shelfNumber.value.trim(),

            status:
                bookStatus.value,

            description:
                bookDescription.value.trim(),

            addedAt:
                new Date().toISOString()

        };


        /* SAVE */

        saveBookToStorage(newBook);


        /* ADD TO TABLE */

        addBookToTable(newBook);


        /* SUCCESS */

        alert(
            "Book added successfully."
        );


        /* RESET */

        addBookForm.reset();


        resetPreview();

    }
);


/* =========================================
   RESET PREVIEW
========================================= */

function resetPreview() {

    liveBookTitle.textContent =
        "Book Title";

    liveBookAuthor.textContent =
        "Author Name";

    liveBookCategory.textContent =
        "Category";

    liveBookISBN.textContent =
        "ISBN";

    liveBookQuantity.textContent =
        "1";

    liveBookShelf.textContent =
        "—";

    liveBookLanguage.textContent =
        "English";


    liveBookStatus.classList.remove(
        "issued",
        "maintenance"
    );

    liveBookStatus.classList.add(
        "available"
    );

    liveBookStatus.textContent =
        "Available";


    coverPreview.innerHTML =
        defaultCoverHTML;


    liveBookCover.innerHTML = `
        <div class="preview-book-icon">
            📖
        </div>

        <span>
            No Cover
        </span>
    `;


    descriptionCount.textContent =
        "0";


    descriptionCount.style.color =
        "";


    clearErrors();

}


/* =========================================
   RESET BUTTON
========================================= */

resetBookForm.addEventListener(
    "click",
    function () {

        setTimeout(
            function () {

                resetPreview();

            },
            0
        );

    }
);


/* =========================================
   LIVE INPUT EVENTS
========================================= */

bookTitle.addEventListener(
    "input",
    updateBookPreview
);


bookAuthor.addEventListener(
    "input",
    updateBookPreview
);


bookISBN.addEventListener(
    "input",
    updateBookPreview
);


bookCategory.addEventListener(
    "change",
    updateBookPreview
);


bookLanguage.addEventListener(
    "change",
    updateBookPreview
);


bookQuantity.addEventListener(
    "input",
    updateBookPreview
);


shelfNumber.addEventListener(
    "input",
    updateBookPreview
);


bookStatus.addEventListener(
    "change",
    updateBookPreview
);


bookDescription.addEventListener(
    "input",
    updateDescriptionCounter
);


bookCover.addEventListener(
    "change",
    previewCoverImage
);


/* =========================================
   REMOVE ERROR WHILE TYPING
========================================= */

bookTitle.addEventListener(
    "input",
    function () {

        if (bookTitle.value.trim().length >= 2) {

            bookTitleError.textContent = "";

            bookTitle
                .closest(".form-group")
                .classList.remove("has-error");

        }

    }
);


bookAuthor.addEventListener(
    "input",
    function () {

        if (bookAuthor.value.trim().length >= 2) {

            bookAuthorError.textContent = "";

            bookAuthor
                .closest(".form-group")
                .classList.remove("has-error");

        }

    }
);


bookISBN.addEventListener(
    "input",
    function () {

        if (bookISBN.value.trim().length >= 10) {

            bookISBNError.textContent = "";

            bookISBN
                .closest(".form-group")
                .classList.remove("has-error");

        }

    }
);


bookCategory.addEventListener(
    "change",
    function () {

        if (bookCategory.value !== "") {

            bookCategoryError.textContent = "";

            bookCategory
                .closest(".form-group")
                .classList.remove("has-error");

        }

    }
);


/* =========================================
   INITIALIZE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateBookPreview();

        updateDescriptionCounter();

        loadSavedBooks();

    }
);