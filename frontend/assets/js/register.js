/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   REGISTER PAGE JAVASCRIPT

   Connected With:
   lms-data.js
========================================= */


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const registerForm =
            document.getElementById(
                "registerForm"
            );


        const password =
            document.getElementById(
                "password"
            );


        const confirmPassword =
            document.getElementById(
                "confirmPassword"
            );


        const passwordToggle =
            document.getElementById(
                "passwordToggle"
            );


        const confirmPasswordToggle =
            document.getElementById(
                "confirmPasswordToggle"
            );


        const formMessage =
            document.getElementById(
                "formMessage"
            );


        /* =================================
           CHECK FORM
        ================================= */

        if (!registerForm) {

            console.error(
                "Register form not found!"
            );

            return;

        }


        /* =================================
           PASSWORD TOGGLE
        ================================= */

        if (passwordToggle) {

            passwordToggle.addEventListener(
                "click",
                function () {

                    if (
                        password.type ===
                        "password"
                    ) {

                        password.type =
                            "text";

                        passwordToggle.textContent =
                            "🙈";

                        passwordToggle.setAttribute(
                            "aria-label",
                            "Hide password"
                        );

                    } else {

                        password.type =
                            "password";

                        passwordToggle.textContent =
                            "👁️";

                        passwordToggle.setAttribute(
                            "aria-label",
                            "Show password"
                        );

                    }

                }
            );

        }


        /* =================================
           CONFIRM PASSWORD TOGGLE
        ================================= */

        if (confirmPasswordToggle) {

            confirmPasswordToggle.addEventListener(
                "click",
                function () {

                    if (
                        confirmPassword.type ===
                        "password"
                    ) {

                        confirmPassword.type =
                            "text";

                        confirmPasswordToggle.textContent =
                            "🙈";

                        confirmPasswordToggle.setAttribute(
                            "aria-label",
                            "Hide password"
                        );

                    } else {

                        confirmPassword.type =
                            "password";

                        confirmPasswordToggle.textContent =
                            "👁️";

                        confirmPasswordToggle.setAttribute(
                            "aria-label",
                            "Show password"
                        );

                    }

                }
            );

        }


        /* =================================
           SHOW MESSAGE
        ================================= */

        function showMessage(
            message,
            type
        ) {

            if (!formMessage) {

                return;

            }


            formMessage.textContent =
                message;


            formMessage.className =
                "form-message " +
                type;

        }


        /* =================================
           REGISTER FORM SUBMIT
        ================================= */

        registerForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                /* =================================
                   GET FORM VALUES
                ================================= */

                const fullName =
                    document
                        .getElementById(
                            "fullName"
                        )
                        .value
                        .trim();


                const email =
                    document
                        .getElementById(
                            "email"
                        )
                        .value
                        .trim()
                        .toLowerCase();


                const phone =
                    document
                        .getElementById(
                            "phone"
                        )
                        .value
                        .trim();


                const role =
                    document
                        .getElementById(
                            "role"
                        )
                        .value;


                const passwordValue =
                    password.value;


                const confirmPasswordValue =
                    confirmPassword.value;


                const terms =
                    document
                        .getElementById(
                            "terms"
                        )
                        .checked;


                /* =================================
                   NAME VALIDATION
                ================================= */

                if (
                    fullName.length < 3
                ) {

                    showMessage(
                        "Please enter a valid full name.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   EMAIL VALIDATION
                ================================= */

                const emailPattern =
                    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


                if (
                    !emailPattern.test(
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

                if (
                    phone !== "" &&
                    !/^[0-9]{10}$/.test(
                        phone
                    )
                ) {

                    showMessage(
                        "Phone number must contain 10 digits.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   ROLE VALIDATION
                ================================= */

                if (
                    role !== "member" &&
                    role !== "librarian"
                ) {

                    showMessage(
                        "Please select a valid account type.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   PASSWORD VALIDATION
                ================================= */

                if (
                    passwordValue.length < 8
                ) {

                    showMessage(
                        "Password must contain at least 8 characters.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   PASSWORD MATCH
                ================================= */

                if (
                    passwordValue !==
                    confirmPasswordValue
                ) {

                    showMessage(
                        "Passwords do not match.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   TERMS VALIDATION
                ================================= */

                if (!terms) {

                    showMessage(
                        "Please accept the Terms & Conditions.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   GET USERS FROM STORAGE
                ================================= */

                let users =
                    getUsers();


                /* =================================
                   CHECK DUPLICATE EMAIL
                ================================= */

                const existingUser =
                    users.find(
                        function (user) {

                            return (
                                String(
                                    user.email || ""
                                )
                                    .toLowerCase()
                                    .trim()
                                ===
                                email
                            );

                        }
                    );


                if (existingUser) {

                    showMessage(
                        "An account with this email already exists.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   GENERATE USER ID
                ================================= */

                let number = 1;


                if (
                    users.length > 0
                ) {

                    const numbers =
                        users.map(
                            function (user) {

                                const match =
                                    String(
                                        user.id || ""
                                    ).match(
                                        /(\d+)$/
                                    );


                                return match
                                    ? Number(
                                        match[1]
                                    )
                                    : 0;

                            }
                        );


                    number =
                        Math.max(
                            ...numbers
                        ) + 1;

                }


                const newUserId =
                    "U" +
                    String(
                        number
                    ).padStart(
                        3,
                        "0"
                    );


                /* =================================
                   CREATE NEW USER
                ================================= */

                const newUser = {

                    id:
                        newUserId,

                    name:
                        fullName,

                    email:
                        email,

                    password:
                        passwordValue,

                    role:
                        role,

                    active:
                        true,

                    createdAt:
                        getToday()

                };


                /* =================================
                   SAVE USER
                ================================= */

                users.push(
                    newUser
                );


                saveUsers(
                    users
                );


                /* =================================
                   SUCCESS MESSAGE
                ================================= */

                showMessage(
                    "Registration successful! Redirecting to login...",
                    "success"
                );


                /* =================================
                   REDIRECT TO LOGIN
                ================================= */

                setTimeout(
                    function () {

                        window.location.href =
                            "./login.html";

                    },
                    1500
                );

            }
        );

    }
);


/* =========================================
   USER STORAGE FUNCTIONS
========================================= */

function getUsers() {

    const storedUsers =
        localStorage.getItem(
            "lmsUsers"
        );


    if (!storedUsers) {

        return [];

    }


    try {

        return JSON.parse(
            storedUsers
        ) || [];

    } catch (error) {

        console.error(
            "Unable to read users:",
            error
        );

        return [];

    }

}


/* =========================================
   SAVE USERS
========================================= */

function saveUsers(
    users
) {

    localStorage.setItem(
        "lmsUsers",
        JSON.stringify(
            users
        )
    );

}


/* =========================================
   GET TODAY
========================================= */

function getToday() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        year +
        "-" +
        month +
        "-" +
        day
    );

}