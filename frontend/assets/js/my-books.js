/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   MY BOOKS JAVASCRIPT
========================================= */


/* =========================================
   DOM ELEMENTS
========================================= */

const myBooksSearch =
    document.getElementById("myBooksSearch");

const filterButtons =
    document.querySelectorAll(".book-filter-button");

const myBooksTableBody =
    document.getElementById("myBooksTableBody");

const emptyMyBooks =
    document.getElementById("emptyMyBooks");

const bookRecordCount =
    document.getElementById("bookRecordCount");

const totalBorrowed =
    document.getElementById("totalBorrowed");

const currentlyIssued =
    document.getElementById("currentlyIssued");

const returnedBooks =
    document.getElementById("returnedBooks");

const overdueBooks =
    document.getElementById("overdueBooks");


/* =========================================
   CURRENT FILTER
========================================= */

let currentFilter = "all";


/* =========================================
   GET BOOK ROWS
========================================= */

function getMyBookRows() {

    return Array.from(
        myBooksTableBody.querySelectorAll("tr")
    );

}


/* =========================================
   UPDATE STATISTICS
========================================= */

function updateStatistics() {

    const rows = getMyBookRows();

    let total = 0;
    let issued = 0;
    let returned = 0;
    let overdue = 0;


    rows.forEach(function (row) {

        const status =
            row.dataset.status.toLowerCase();


        total++;


        if (status === "issued") {
            issued++;
        }


        if (status === "returned") {
            returned++;
        }


        if (status === "overdue") {
            overdue++;
        }

    });


    totalBorrowed.textContent = total;

    currentlyIssued.textContent = issued;

    returnedBooks.textContent = returned;

    overdueBooks.textContent = overdue;

}


/* =========================================
   FILTER BOOKS
========================================= */

function filterMyBooks() {

    const searchValue =
        myBooksSearch.value
            .trim()
            .toLowerCase();


    const rows = getMyBookRows();

    let visibleCount = 0;


    rows.forEach(function (row) {

        const rowText =
            row.textContent.toLowerCase();


        const rowStatus =
            row.dataset.status.toLowerCase();


        const matchesSearch =
            searchValue === "" ||
            rowText.includes(searchValue);


        let matchesFilter = true;


        if (currentFilter === "issued") {

            matchesFilter =
                rowStatus === "issued";

        }


        else if (currentFilter === "returned") {

            matchesFilter =
                rowStatus === "returned";

        }


        else if (currentFilter === "overdue") {

            matchesFilter =
                rowStatus === "overdue";

        }


        if (
            matchesSearch &&
            matchesFilter
        ) {

            row.style.display = "";

            visibleCount++;

        }

        else {

            row.style.display = "none";

        }

    });


    updateRecordCount(visibleCount);

    updateEmptyState(visibleCount);

}


/* =========================================
   UPDATE RECORD COUNT
========================================= */

function updateRecordCount(count) {

    if (count === 1) {

        bookRecordCount.textContent =
            "Showing 1 record";

    }

    else {

        bookRecordCount.textContent =
            "Showing " + count + " records";

    }

}


/* =========================================
   EMPTY STATE
========================================= */

function updateEmptyState(count) {

    if (count === 0) {

        emptyMyBooks.classList.add("show");

    }

    else {

        emptyMyBooks.classList.remove("show");

    }

}


/* =========================================
   FILTER BUTTON ACTIVE STATE
========================================= */

function setActiveFilter(button) {

    filterButtons.forEach(function (item) {

        item.classList.remove("active");

    });


    button.classList.add("active");

}


/* =========================================
   FILTER BUTTON EVENTS
========================================= */

filterButtons.forEach(function (button) {

    button.addEventListener(
        "click",
        function () {

            currentFilter =
                button.dataset.filter;


            setActiveFilter(button);

            filterMyBooks();

        }
    );

});


/* =========================================
   SEARCH EVENT
========================================= */

myBooksSearch.addEventListener(
    "input",
    function () {

        filterMyBooks();

    }
);


/* =========================================
   INITIALIZE PAGE
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        updateStatistics();

        filterMyBooks();

    }
);