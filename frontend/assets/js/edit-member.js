/* =========================================
   EDIT MEMBER MANAGEMENT
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

        const editMemberForm =
            document.getElementById(
                "editMemberForm"
            );


        if (!editMemberForm) {

            console.error(
                "Edit Member Form not found!"
            );

            return;

        }


        /* =================================
           GET MEMBER ID FROM URL

           Example:
           edit-member.html?id=M001
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

            showMessage(
                "Member ID is missing!",
                "error"
            );

            disableForm();

            return;

        }


        /* =================================
           LOAD MEMBER DETAILS
        ================================= */

        loadMemberDetails(
            memberId
        );


        /* =================================
           FORM SUBMIT
        ================================= */

        editMemberForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();

                updateMember(
                    memberId
                );

            }
        );


        /* =================================
           RESET BUTTON
        ================================= */

        const resetButton =
            document.getElementById(
                "resetMemberBtn"
            );


        if (resetButton) {

            resetButton.addEventListener(
                "click",
                function () {

                    setTimeout(
                        function () {

                            loadMemberDetails(
                                memberId
                            );

                        },
                        0
                    );

                }
            );

        }


        /* =================================
           MOBILE MENU
        ================================= */

        setupMobileMenu();

    }
);


/* =========================================
   LOAD MEMBER DETAILS
   FROM CENTRAL STORAGE
========================================= */

function loadMemberDetails(
    memberId
) {

    /* =================================
       GET MEMBER
    ================================= */

    const member =
        getMember(
            memberId
        );


    /* =================================
       MEMBER NOT FOUND
    ================================= */

    if (!member) {

        showMessage(
            "Member not found!",
            "error"
        );

        disableForm();

        return;

    }


    /* =================================
       FILL FORM
    ================================= */

    setValue(
        "memberId",
        member.id
    );


    setValue(
        "memberName",
        member.name
    );


    setValue(
        "memberEmail",
        member.email
    );


    setValue(
        "memberPhone",
        member.phone
    );


    setValue(
        "membershipDate",
        member.joinDate
    );


    setValue(
        "memberStatus",
        member.active
            ? "active"
            : "inactive"
    );


    /* =================================
       PAGE TITLE
    ================================= */

    document.title =
        "Edit " +
        member.name +
        " | Library Management System";


    /* =================================
       MEMBER ACTIVITY
    ================================= */

    updateMemberActivityInfo(
        member
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
   UPDATE MEMBER
========================================= */

function updateMember(
    memberId
) {

    /* =================================
       GET FORM VALUES
    ================================= */

    const name =
        getValue(
            "memberName"
        );


    const email =
        getValue(
            "memberEmail"
        );


    const phone =
        getValue(
            "memberPhone"
        );


    const membershipDate =
        getValue(
            "membershipDate"
        );


    const status =
        getValue(
            "memberStatus"
        );


    /* =================================
       VALIDATION
    ================================= */

    if (!name) {

        showMessage(
            "Please enter member name.",
            "error"
        );

        return;

    }


    if (name.length < 2) {

        showMessage(
            "Member name must contain at least 2 characters.",
            "error"
        );

        return;

    }


    /* =================================
       EMAIL VALIDATION
    ================================= */

    if (!email) {

        showMessage(
            "Please enter email address.",
            "error"
        );

        return;

    }


    if (
        !isValidEmail(
            email
        )
    ) {

        showMessage(
            "Please enter a valid email address.",
            "error"
        );

        return;

    }


    /* =================================
       PHONE VALIDATION
    ================================= */

    if (!phone) {

        showMessage(
            "Please enter phone number.",
            "error"
        );

        return;

    }


    if (
        !isValidPhone(
            phone
        )
    ) {

        showMessage(
            "Please enter a valid phone number.",
            "error"
        );

        return;

    }


    /* =================================
       MEMBERSHIP DATE
    ================================= */

    if (!membershipDate) {

        showMessage(
            "Please select membership date.",
            "error"
        );

        return;

    }


    /* =================================
       STATUS VALIDATION
    ================================= */

    if (
        status !== "active" &&
        status !== "inactive"
    ) {

        showMessage(
            "Please select a valid member status.",
            "error"
        );

        return;

    }


    /* =================================
       GET CENTRAL MEMBERS
    ================================= */

    const members =
        getMembers();


    /* =================================
       FIND MEMBER
    ================================= */

    const memberIndex =
        members.findIndex(
            function (member) {

                return String(
                    member.id
                ) === String(
                    memberId
                );

            }
        );


    /* =================================
       MEMBER NOT FOUND
    ================================= */

    if (
        memberIndex === -1
    ) {

        showMessage(
            "Member not found in central storage.",
            "error"
        );

        return;

    }


    /* =================================
       EXISTING MEMBER
    ================================= */

    const existingMember =
        members[
            memberIndex
        ];


    /* =================================
       CHECK DUPLICATE EMAIL
    ================================= */

    const duplicateEmail =
        members.some(
            function (member) {

                return (

                    String(
                        member.id
                    ) !== String(
                        memberId
                    )

                    &&

                    String(
                        member.email || ""
                    )
                        .toLowerCase()
                        .trim() ===
                    email
                        .toLowerCase()
                        .trim()

                );

            }
        );


    if (duplicateEmail) {

        showMessage(
            "This email address is already registered with another member.",
            "error"
        );

        return;

    }


    /* =================================
       CHECK ACTIVE TRANSACTIONS
    ================================= */

    const transactions =
        getTransactions();


    const activeTransactions =
        transactions.filter(
            function (transaction) {

                return (

                    String(
                        transaction.memberId
                    ) === String(
                        memberId
                    )

                    &&

                    transaction.status !==
                    "returned"

                );

            }
        );


    /* =================================
       PREVENT DEACTIVATION
       WITH ACTIVE BOOKS
    ================================= */

    if (
        status === "inactive"
        &&
        existingMember.active === true
        &&
        activeTransactions.length > 0
    ) {

        showMessage(
            `Cannot deactivate this member because ${activeTransactions.length} active book issue(s) are associated with this member.`,
            "error"
        );

        return;

    }


    /* =================================
       CONFIRM UPDATE
    ================================= */

    const confirmed =
        confirm(
            `Update member "${existingMember.name}"?`
        );


    if (!confirmed) {

        return;

    }


    /* =================================
       CREATE UPDATED MEMBER
    ================================= */

    members[
        memberIndex
    ] = {

        ...existingMember,

        id:
            existingMember.id,

        name:
            name,

        email:
            email,

        phone:
            phone,

        joinDate:
            membershipDate,

        active:
            status === "active"

    };


    /* =================================
       SAVE CENTRAL DATA
    ================================= */

    saveMembers(
        members
    );


    /* =================================
       SUCCESS MESSAGE
    ================================= */

    showMessage(
        "Member updated successfully!",
        "success"
    );


    /* =================================
       REDIRECT
    ================================= */

    setTimeout(
        function () {

            window.location.href =
                "members.html";

        },
        1000
    );

}


/* =========================================
   UPDATE MEMBER ACTIVITY INFORMATION
========================================= */

function updateMemberActivityInfo(
    member
) {

    const container =
        document.getElementById(
            "memberActivityInfo"
        );


    if (!container) {

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
       DISPLAY ACTIVITY
    ================================= */

    container.innerHTML = `

        <div class="activity-info-header">

            <h3>
                📊 Member Activity
            </h3>

        </div>


        <div class="activity-info-grid">


            <div class="activity-info-item">

                <span>
                    Total Transactions
                </span>

                <strong>

                    ${memberTransactions.length}

                </strong>

            </div>



            <div class="activity-info-item">

                <span>
                    Active Issues
                </span>

                <strong>

                    ${activeTransactions.length}

                </strong>

            </div>



            <div class="activity-info-item">

                <span>
                    Returned Books
                </span>

                <strong>

                    ${returnedTransactions.length}

                </strong>

            </div>



            <div class="activity-info-item">

                <span>
                    Current Status
                </span>

                <strong>

                    ${
                        member.active
                            ? "Active"
                            : "Inactive"
                    }

                </strong>

            </div>

        </div>

    `;

}


/* =========================================
   VALIDATE EMAIL
========================================= */

function isValidEmail(
    email
) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(
            String(
                email
            ).trim()
        );

}


/* =========================================
   VALIDATE PHONE
========================================= */

function isValidPhone(
    phone
) {

    const cleanPhone =
        String(
            phone
        )
            .replace(
                /[\s-]/g,
                ""
            );


    return /^\+?\d{10,13}$/
        .test(
            cleanPhone
        );

}


/* =========================================
   DISABLE FORM
========================================= */

function disableForm() {

    const form =
        document.getElementById(
            "editMemberForm"
        );


    if (!form) {

        return;

    }


    const fields =
        form.querySelectorAll(
            "input, select, button"
        );


    fields.forEach(
        function (field) {

            field.disabled =
                true;

        }
    );

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
                "editMemberForm"
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