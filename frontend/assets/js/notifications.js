/* =========================================
   NOTIFICATIONS MANAGEMENT
========================================= */


/* =========================================
   SAMPLE NOTIFICATIONS
========================================= */

let notifications = [

    {
        id: 1,
        title: "Book Due Date Approaching",
        message: "Python Crash Course is due on 15 Aug 2026.",
        type: "book",
        icon: "📖",
        iconClass: "",
        important: true,
        read: false,
        time: "10 minutes ago"
    },

    {
        id: 2,
        title: "Book Overdue",
        message: "Introduction to Algorithms is overdue. Please return it as soon as possible.",
        type: "book",
        icon: "⚠️",
        iconClass: "warning",
        important: true,
        read: false,
        time: "1 hour ago"
    },

    {
        id: 3,
        title: "Book Successfully Issued",
        message: "JavaScript: The Good Parts has been successfully issued to your account.",
        type: "book",
        icon: "📚",
        iconClass: "success",
        important: false,
        read: true,
        time: "Yesterday"
    },

    {
        id: 4,
        title: "Library Announcement",
        message: "The library will remain open until 8:00 PM during examination week.",
        type: "general",
        icon: "📢",
        iconClass: "",
        important: false,
        read: true,
        time: "2 days ago"
    },

    {
        id: 5,
        title: "Fine Generated",
        message: "A fine of ₹45 has been added for your overdue book.",
        type: "general",
        icon: "💰",
        iconClass: "danger",
        important: true,
        read: false,
        time: "3 days ago"
    }

];


/* =========================================
   DOM ELEMENTS
========================================= */

const notificationsList =
    document.getElementById("notificationsList");

const notificationSearch =
    document.getElementById("notificationSearch");

const markAllBtn =
    document.getElementById("markAllBtn");

const clearAllBtn =
    document.getElementById("clearAllBtn");

const filterButtons =
    document.querySelectorAll(".filter-button");


/* =========================================
   CURRENT FILTER
========================================= */

let currentFilter = "all";


/* =========================================
   PAGE LOAD
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        displayNotifications();

        updateStatistics();

        notificationSearch.addEventListener(
            "input",
            displayNotifications
        );


        filterButtons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        filterButtons.forEach(
                            function (item) {

                                item.classList.remove(
                                    "active"
                                );

                            }
                        );


                        button.classList.add(
                            "active"
                        );


                        currentFilter =
                            button.dataset.filter;


                        displayNotifications();

                    }
                );

            }
        );


        markAllBtn.addEventListener(
            "click",
            markAllAsRead
        );


        clearAllBtn.addEventListener(
            "click",
            clearAllNotifications
        );

    }
);


/* =========================================
   DISPLAY NOTIFICATIONS
========================================= */

function displayNotifications() {

    const searchText =
        notificationSearch.value
            .toLowerCase()
            .trim();


    let filteredNotifications =
        notifications.filter(
            function (notification) {

                const matchesSearch =

                    notification.title
                        .toLowerCase()
                        .includes(searchText)

                    ||

                    notification.message
                        .toLowerCase()
                        .includes(searchText);


                if (!matchesSearch) {
                    return false;
                }


                if (currentFilter === "unread") {

                    return notification.read === false;

                }


                if (currentFilter === "book") {

                    return notification.type === "book";

                }


                if (currentFilter === "important") {

                    return notification.important === true;

                }


                return true;

            }
        );


    notificationsList.innerHTML = "";


    if (filteredNotifications.length === 0) {

        notificationsList.innerHTML = `

            <div class="empty-notifications">

                <div class="empty-notifications-icon">
                    🔔
                </div>

                <h3>
                    No Notifications Found
                </h3>

                <p>
                    There are no notifications matching your search or filter.
                </p>

            </div>

        `;

        return;

    }


    filteredNotifications.forEach(
        function (notification) {

            const card =
                document.createElement("article");


            card.className =
                "notification-card";


            if (!notification.read) {

                card.classList.add("unread");

            }


            const unreadBadge =
                !notification.read
                    ? `<span class="notification-badge">NEW</span>`
                    : "";


            const markReadButton =
                !notification.read

                    ? `
                        <button
                            type="button"
                            class="mark-read"
                            data-id="${notification.id}"
                            title="Mark as read">

                            ✓

                        </button>
                      `

                    : "";


            card.innerHTML = `

                <div class="notification-icon ${notification.iconClass}">
                    ${notification.icon}
                </div>


                <div class="notification-content">

                    <h3>
                        ${notification.title}

                        ${unreadBadge}
                    </h3>

                    <p>
                        ${notification.message}
                    </p>

                    <span class="notification-time">
                        ${notification.time}
                    </span>

                </div>


                <div class="notification-card-actions">

                    ${markReadButton}


                    <button
                        type="button"
                        class="delete-notification"
                        data-id="${notification.id}"
                        title="Delete notification">

                        🗑

                    </button>

                </div>

            `;


            notificationsList.appendChild(card);

        }
    );


    attachNotificationActions();

}


/* =========================================
   CARD ACTIONS
========================================= */

function attachNotificationActions() {


    const markReadButtons =
        document.querySelectorAll(
            ".mark-read"
        );


    markReadButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const id =
                        Number(
                            button.dataset.id
                        );


                    const notification =
                        notifications.find(
                            item =>
                                item.id === id
                        );


                    if (notification) {

                        notification.read = true;

                    }


                    displayNotifications();

                    updateStatistics();

                }
            );

        }
    );


    const deleteButtons =
        document.querySelectorAll(
            ".delete-notification"
        );


    deleteButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const id =
                        Number(
                            button.dataset.id
                        );


                    notifications =
                        notifications.filter(
                            item =>
                                item.id !== id
                        );


                    displayNotifications();

                    updateStatistics();

                }
            );

        }
    );

}


/* =========================================
   MARK ALL AS READ
========================================= */

function markAllAsRead() {

    notifications.forEach(
        function (notification) {

            notification.read = true;

        }
    );


    displayNotifications();

    updateStatistics();

}


/* =========================================
   CLEAR ALL
========================================= */

function clearAllNotifications() {

    if (notifications.length === 0) {
        return;
    }


    const confirmation =
        confirm(
            "Are you sure you want to clear all notifications?"
        );


    if (!confirmation) {
        return;
    }


    notifications = [];


    displayNotifications();

    updateStatistics();

}


/* =========================================
   STATISTICS
========================================= */

function updateStatistics() {

    const total =
        notifications.length;


    const unread =
        notifications.filter(
            notification =>
                notification.read === false
        ).length;


    const bookAlerts =
        notifications.filter(
            notification =>
                notification.type === "book"
        ).length;


    const important =
        notifications.filter(
            notification =>
                notification.important === true
        ).length;


    document.getElementById(
        "totalNotifications"
    ).textContent = total;


    document.getElementById(
        "unreadNotifications"
    ).textContent = unread;


    document.getElementById(
        "bookAlerts"
    ).textContent = bookAlerts;


    document.getElementById(
        "importantNotifications"
    ).textContent = important;

}