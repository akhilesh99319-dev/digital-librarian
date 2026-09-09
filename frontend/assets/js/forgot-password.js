/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   FORGOT PASSWORD JAVASCRIPT

   Connected With:
   lmsUsers
========================================= */


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const forgotForm =
            document.getElementById(
                "forgotPasswordForm"
            );


        const emailInput =
            document.getElementById(
                "forgotEmail"
            );


        const messageBox =
            document.getElementById(
                "forgotMessage"
            );


        /* =================================
           CHECK FORM
        ================================= */

        if (!forgotForm) {

            console.error(
                "Forgot password form not found!"
            );

            return;

        }


        /* =================================
           FORM SUBMIT
        ================================= */

        forgotForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                /* =================================
                   GET EMAIL
                ================================= */

                const email =
                    emailInput.value
                        .trim()
                        .toLowerCase();


                /* =================================
                   VALIDATE EMAIL
                ================================= */

                if (!email) {

                    showForgotMessage(
                        "Please enter your email address.",
                        "error"
                    );

                    emailInput.focus();

                    return;

                }


                if (
                    !isValidEmail(
                        email
                    )
                ) {

                    showForgotMessage(
                        "Please enter a valid email address.",
                        "error"
                    );

                    emailInput.focus();

                    return;

                }


                /* =================================
                   GET USERS
                ================================= */

                const users =
                    getUsers();


                /* =================================
                   FIND USER
                ================================= */

                const user =
                    users.find(
                        function (item) {

                            return (
                                String(
                                    item.email || ""
                                )
                                    .toLowerCase()
                                    .trim()
                                ===
                                email
                            );

                        }
                    );


                /* =================================
                   USER NOT FOUND
                ================================= */

                if (!user) {

                    showForgotMessage(
                        "No account was found with this email address.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   CHECK ACCOUNT STATUS
                ================================= */

                if (
                    user.active !== true
                ) {

                    showForgotMessage(
                        "This account is inactive. Please contact the library administrator.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   STORE RECOVERY EMAIL
                ================================= */

                sessionStorage.setItem(
                    "lmsPasswordResetEmail",
                    user.email
                );


                /* =================================
                   SUCCESS
                ================================= */

                showForgotMessage(
                    "Account found! Redirecting to password reset...",
                    "success"
                );


                /* =================================
                   REDIRECT
                ================================= */

                setTimeout(
                    function () {

                        window.location.href =
                            "./reset-password.html";

                    },
                    1000
                );

            }
        );


        /* =================================
           SHOW MESSAGE
        ================================= */

        function showForgotMessage(
            message,
            type
        ) {

            if (!messageBox) {

                return;

            }


            messageBox.textContent =
                message;


            messageBox.className =
                "forgot-message " +
                type;

        }

    }
);


/* =========================================
   GET USERS
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
   EMAIL VALIDATION
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