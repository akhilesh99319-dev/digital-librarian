/* =========================================
   LMS CENTRAL DATA SYSTEM
   Library Management System
========================================= */

const LMS_STORAGE = {
    BOOKS: "lmsBooks",
    MEMBERS: "lmsMembers",
    TRANSACTIONS: "lmsTransactions"
};


/* =========================================
   DEFAULT BOOKS
========================================= */

const DEFAULT_BOOKS = [

    {
        id: "B001",
        title: "Introduction to Algorithms",
        author: "Thomas H. Cormen",
        category: "Computer Science",
        isbn: "9780262033848",
        publisher: "MIT Press",
        year: "2009",
        quantity: 5,
        available: 4,
        location: "Shelf A-01",
        description:
            "A comprehensive introduction to algorithms and data structures."
    },

    {
        id: "B002",
        title: "Clean Code",
        author: "Robert C. Martin",
        category: "Programming",
        isbn: "9780132350884",
        publisher: "Prentice Hall",
        year: "2008",
        quantity: 4,
        available: 3,
        location: "Shelf A-02",
        description:
            "A practical guide to writing clean, readable and maintainable software."
    },

    {
        id: "B003",
        title: "JavaScript: The Good Parts",
        author: "Douglas Crockford",
        category: "Programming",
        isbn: "9780596517748",
        publisher: "O'Reilly Media",
        year: "2008",
        quantity: 5,
        available: 5,
        location: "Shelf A-03",
        description:
            "A guide to the powerful features of JavaScript."
    },

    {
        id: "B004",
        title: "Python Crash Course",
        author: "Eric Matthes",
        category: "Programming",
        isbn: "9781593279288",
        publisher: "No Starch Press",
        year: "2019",
        quantity: 4,
        available: 3,
        location: "Shelf B-01",
        description:
            "A hands-on introduction to Python programming."
    },

    {
        id: "B005",
        title: "Database System Concepts",
        author: "Abraham Silberschatz",
        category: "Database",
        isbn: "9780073523323",
        publisher: "McGraw-Hill",
        year: "2019",
        quantity: 5,
        available: 5,
        location: "Shelf B-02",
        description:
            "A comprehensive introduction to database systems."
    },

    {
        id: "B006",
        title: "Computer Networks",
        author: "Andrew S. Tanenbaum",
        category: "Networking",
        isbn: "9780132126953",
        publisher: "Pearson",
        year: "2011",
        quantity: 4,
        available: 4,
        location: "Shelf B-03",
        description:
            "An introduction to computer networking concepts."
    }

];


/* =========================================
   DEFAULT MEMBERS
========================================= */

const DEFAULT_MEMBERS = [

    {
        id: "M001",
        name: "Akhilesh Kumar",
        active: true
    },

    {
        id: "M002",
        name: "Chandra Mohan Thakur",
        active: true
    },

    {
        id: "M003",
        name: "Aman Kumar",
        active: true
    },

    {
        id: "M004",
        name: "Ashish Kumar Singh",
        active: true
    },

    {
        id: "M005",
        name: "Sonali Kumari",
        active: true
    },

    {
        id: "M006",
        name: "Sonam Kumari",
        active: true
    },

    {
        id: "M007",
        name: "Manish Kumar",
        active: true
    },

    {
        id: "M008",
        name: "Nishu Kumari",
        active: false
    }

];

/* =========================================
   DEFAULT USERS
========================================= */

const DEFAULT_USERS = [];

/* =========================================
   INITIALIZE STORAGE
========================================= */

function initializeLMSData() {

    if (!localStorage.getItem(LMS_STORAGE.BOOKS)) {

        localStorage.setItem(
            LMS_STORAGE.BOOKS,
            JSON.stringify(DEFAULT_BOOKS)
        );

    }


    if (!localStorage.getItem(LMS_STORAGE.MEMBERS)) {

        localStorage.setItem(
            LMS_STORAGE.MEMBERS,
            JSON.stringify(DEFAULT_MEMBERS)
        );

    }


    if (!localStorage.getItem(LMS_STORAGE.TRANSACTIONS)) {

        localStorage.setItem(
            LMS_STORAGE.TRANSACTIONS,
            JSON.stringify([])
        );

    }

}


/* =========================================
   BOOK FUNCTIONS
========================================= */

function getBooks() {

    return JSON.parse(
        localStorage.getItem(LMS_STORAGE.BOOKS)
    ) || [];

}


function saveBooks(books) {

    localStorage.setItem(
        LMS_STORAGE.BOOKS,
        JSON.stringify(books)
    );

}


function getBook(bookId) {

    return getBooks().find(
        book =>
            String(book.id) === String(bookId)
    );

}


/* =========================================
   MEMBER FUNCTIONS
========================================= */

function getMembers() {

    return JSON.parse(
        localStorage.getItem(LMS_STORAGE.MEMBERS)
    ) || [];

}


function getMember(memberId) {

    return getMembers().find(
        member =>
            String(member.id) === String(memberId)
    );

}


/* =========================================
   TRANSACTION FUNCTIONS
========================================= */

function getTransactions() {

    return JSON.parse(
        localStorage.getItem(
            LMS_STORAGE.TRANSACTIONS
        )
    ) || [];

}


function saveTransactions(transactions) {

    localStorage.setItem(
        LMS_STORAGE.TRANSACTIONS,
        JSON.stringify(transactions)
    );

}


/* =========================================
   GENERATE TRANSACTION ID
========================================= */

function generateTransactionId() {

    const transactions =
        getTransactions();

    let number =
        transactions.length + 1;

    let id =
        "TX" +
        String(number).padStart(4, "0");


    while (
        transactions.some(
            transaction =>
                transaction.id === id
        )
    ) {

        number++;

        id =
            "TX" +
            String(number).padStart(4, "0");

    }


    return id;

}


/* =========================================
   DATE FORMAT
========================================= */

function getToday() {

    const date = new Date();

    return formatInputDate(date);

}


function formatInputDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");


    return `${year}-${month}-${day}`;

}


/* =========================================
   INITIALIZE
========================================= */

initializeLMSData();