/* =========================================
   LIBRARY MANAGEMENT SYSTEM
   RESET PASSWORD JAVASCRIPT

   Connected With:
   lmsUsers
========================================= */


/* =========================================
   PAGE INITIALIZATION
========================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const resetForm =
            document.getElementById(
                "resetPasswordForm"
            );


        const newPassword =
            document.getElementById(
                "newPassword"
            );


        const confirmNewPassword =
            document.getElementById(
                "confirmNewPassword"
            );


        const newPasswordToggle =
            document.getElementById(
                "newPasswordToggle"
            );


        const confirmNewPasswordToggle =
            document.getElementById(
                "confirmNewPasswordToggle"
            );


        const resetMessage =
            document.getElementById(
                "resetMessage"
            );


        /* =================================
           CHECK FORM
        ================================= */

        if (!resetForm) {

            console.error(
                "Reset password form not found!"
            );

            return;

        }


        /* =================================
           CHECK RECOVERY EMAIL
        ================================= */

        const resetEmail =
            sessionStorage.getItem(
                "lmsPasswordResetEmail"
            );


        if (!resetEmail) {

            showMessage(
                "Password reset session has expired. Please start again.",
                "error"
            );


            disableResetForm();


            return;

        }


        /* =================================
           PASSWORD TOGGLE
        ================================= */

        if (newPasswordToggle) {

            newPasswordToggle.addEventListener(
                "click",
                function () {

                    togglePassword(
                        newPassword,
                        newPasswordToggle
                    );

                }
            );

        }


        /* =================================
           CONFIRM PASSWORD TOGGLE
        ================================= */

        if (
            confirmNewPasswordToggle
        ) {

            confirmNewPasswordToggle.addEventListener(
                "click",
                function () {

                    togglePassword(
                        confirmNewPassword,
                        confirmNewPasswordToggle
                    );

                }
            );

        }


        /* =================================
           FORM SUBMIT
        ================================= */

        resetForm.addEventListener(
            "submit",
            function (event) {

                event.preventDefault();


                const passwordValue =
                    newPassword.value;


                const confirmValue =
                    confirmNewPassword.value;


                /* =================================
                   PASSWORD LENGTH
                ================================= */

                if (
                    passwordValue.length < 8
                ) {

                    showMessage(
                        "Password must contain at least 8 characters.",
                        "error"
                    );

                    newPassword.focus();

                    return;

                }


                /* =================================
                   PASSWORD MATCH
                ================================= */

                if (
                    passwordValue !==
                    confirmValue
                ) {

                    showMessage(
                        "Passwords do not match.",
                        "error"
                    );

                    confirmNewPassword.focus();

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

                const userIndex =
                    users.findIndex(
                        function (user) {

                            return (
                                String(
                                    user.email || ""
                                )
                                    .toLowerCase()
                                    .trim()
                                ===
                                String(
                                    resetEmail
                                )
                                    .toLowerCase()
                                    .trim()
                            );

                        }
                    );


                /* =================================
                   USER NOT FOUND
                ================================= */

                if (
                    userIndex === -1
                ) {

                    showMessage(
                        "User account could not be found.",
                        "error"
                    );

                    return;

                }


                /* =================================
                   UPDATE PASSWORD
                ================================= */

                users[
                    userIndex
                ].password =
                    passwordValue;


                /* =================================
                   SAVE USERS
                ================================= */

                saveUsers(
                    users
                );


                /* =================================
                   REMOVE RESET SESSION
                ================================= */

                sessionStorage.removeItem(
                    "lmsPasswordResetEmail"
                );


                /* =================================
                   SUCCESS MESSAGE
                ================================= */

                showMessage(
                    "Password reset successfully! Redirecting to login...",
                    "success"
                );


                /* =================================
                   REDIRECT
                ================================= */

                setTimeout(
                    function () {

                        window.location.href =
                            "./login.html";

                    },
                    1200
                );

            }
        );


        /* =================================
           TOGGLE PASSWORD FUNCTION
        ================================= */

        function togglePassword(
            input,
            button
        ) {

            if (
                input.type ===
                "password"
            ) {

                input.type =
                    "text";

                button.textContent =
                    "🙈";

                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                input.type =
                    "password";

                button.textContent =
                    "👁️";

                button.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        }


        /* =================================
           SHOW MESSAGE
        ================================= */

        function showMessage(
            message,
            type
        ) {

            if (!resetMessage) {

                return;

            }


            resetMessage.textContent =
                message;


            resetMessage.className =
                "forgot-message " +
                type;

        }


        /* =================================
           DISABLE FORM
        ================================= */

        function disableResetForm() {

            const fields =
                resetForm.querySelectorAll(
                    "input, button"
                );


            fields.forEach(
                function (field) {

                    field.disabled =
                        true;

                }
            );

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