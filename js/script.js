
/* ==========================================
   FIREBASE
========================================== */

import { db, auth } from "./firebase.js";

import {
    collection,
    doc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


/* ==========================================
   CONFIGURACIÓN DE USUARIOS
========================================== */

const ADMIN_UID = "53x9OTzsIqZgWyaES5gVUFAUprC3";

const COLLABORATOR_UIDS = [
    "mTC8hayXPrRzXOXKXXyZaFDXrrg2"
];

const validCategories = [
    "Videojuegos",
    "Anime",
    "Pendejadas"
];

let isAdmin = false;
let isCollaborator = false;
let currentUser = null;

let posts = [];
let currentCategory = "Inicio";
let editingPostId = null;

let selectedPostImage = null;
let selectedProfileImage = null;

let profile = {
    name: "Tu nombre",
    description: "Todavía no hay descripción.",
    age: "",
    image: ""
};


/* ==========================================
   PERMISOS
========================================== */

function canPublish() {
    return isAdmin || isCollaborator;
}


/* ==========================================
   ELEMENTOS DEL HTML
========================================== */

// Navegación
const homeLink = document.getElementById("home-link");
const homeNavLink = document.getElementById("home-nav-link");
const profileLink = document.getElementById("profile-link");

const homeSection = document.getElementById("home-section");
const profileSection = document.getElementById("profile-section");

// Categorías
const categoryButtons = document.querySelectorAll(".category-btn");

// Publicaciones
const postForm = document.getElementById("post-form");
const postContent = document.getElementById("post-content");
const postCategory = document.getElementById("post-category");
const postsContainer = document.getElementById("posts-container");

const formTitle = document.getElementById("form-title");
const submitButton = document.getElementById("submit-button");
const cancelButton = document.getElementById("cancel-button");

const postImage = document.getElementById("post-image");
const imagePreview = document.getElementById("image-preview");

// Perfil
const editProfileButton = document.getElementById("edit-profile-button");
const profileForm = document.getElementById("profile-form");
const cancelProfileButton = document.getElementById("cancel-profile-button");

const profileNameInput = document.getElementById("profile-name-input");
const profileDescriptionInput = document.getElementById("profile-description-input");
const profileAgeInput = document.getElementById("profile-age-input");

const profileImageInput = document.getElementById("profile-image-input");
const profileImagePreview = document.getElementById("profile-image-preview");

const profileName = document.getElementById("profile-name");
const profileDescription = document.getElementById("profile-description");
const profileAge = document.getElementById("profile-age");
const profileImage = document.getElementById("profile-image");

// Administración
const adminLoginForm = document.getElementById("admin-login-form");
const adminEmail = document.getElementById("admin-email");
const adminPassword = document.getElementById("admin-password");
const adminLogoutButton = document.getElementById("admin-logout-button");
const adminStatus = document.getElementById("admin-status");
const profileAdminControls = document.getElementById("profile-admin-controls");


/* ==========================================
   UTILIDADES
========================================== */

function showMessage(element, message) {
    if (element) {
        element.textContent = message;
    }
}

function setAdminUI() {
    const loggedIn = canPublish();

    postForm.hidden = !loggedIn;
    profileAdminControls.hidden = !isAdmin;

    adminLoginForm.hidden = loggedIn;
    adminLogoutButton.hidden = !loggedIn;

    if (!isAdmin) {
        profileForm.hidden = true;
    }

    if (!loggedIn) {
        resetPostForm();
    }
}

function readImage(file, maxSize) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(new Error("Selecciona un archivo de imagen válido."));
            return;
        }

        if (file.size > maxSize) {
            reject(new Error(
                `La imagen debe pesar menos de ${Math.round(maxSize / 1024)} KB.`
            ));
            return;
        }

        const reader = new FileReader();

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo leer la imagen."));

        reader.readAsDataURL(file);
    });
}


/* ==========================================
   NAVEGACIÓN
========================================== */

function showPage(page) {
    const showingProfile = page === "profile";

    homeSection.hidden = showingProfile;
    profileSection.hidden = !showingProfile;
}

function goHome(event) {
    event.preventDefault();
    showPage("home");
}

homeLink.addEventListener("click", goHome);
homeNavLink.addEventListener("click", goHome);

profileLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage("profile");
});


/* ==========================================
   AUTENTICACIÓN
========================================== */

adminLoginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = adminEmail.value.trim();
    const password = adminPassword.value;

    showMessage(adminStatus, "Iniciando sesión...");

    try {
        await signInWithEmailAndPassword(auth, email, password);
        adminPassword.value = "";

    } catch (error) {
        console.error("Error al iniciar sesión:", error);

        showMessage(
            adminStatus,
            "No se pudo iniciar sesión. Revisa tu correo y contraseña."
        );
    }
});

adminLogoutButton.addEventListener("click", async function() {
    try {
        await signOut(auth);
        showMessage(adminStatus, "Sesión cerrada.");

    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        showMessage(adminStatus, "No se pudo cerrar la sesión.");
    }
});

onAuthStateChanged(auth, async function(user) {
    currentUser = user;

    isAdmin = !!user && user.uid === ADMIN_UID;

    isCollaborator = !!user &&
        COLLABORATOR_UIDS.includes(user.uid);

    if (isAdmin) {
        showMessage(adminStatus, "Sesión iniciada como administrador.");

    } else if (isCollaborator) {
        showMessage(adminStatus, "Sesión iniciada como colaborador. Puedes publicar.");

    } else if (user) {
        showMessage(adminStatus, "Esta cuenta no tiene permisos.");

        await signOut(auth);

    } else {
        showMessage(adminStatus, "");
    }

    setAdminUI();
    renderPosts();
});


/* ==========================================
   PUBLICACIONES: ESCUCHAR FIRESTORE
========================================== */

const postsQuery = query(
    collection(db, "posts"),
    orderBy("date", "desc")
);

onSnapshot(postsQuery, function(snapshot) {
    posts = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
    }));

    renderPosts();

}, function(error) {
    console.error("Error al cargar publicaciones:", error);

    postsContainer.textContent =
        "No se pudieron cargar las publicaciones. Intenta más tarde.";
});


/* ==========================================
   CREAR PUBLICACIÓN
========================================== */

async function createPost(content, category, image) {
    if (!canPublish()) return;

    try {
        await addDoc(collection(db, "posts"), {
            content,
            category,
            image: image || "",
            date: new Date().toISOString()
        });

        resetPostForm();

    } catch (error) {
        console.error("Error al crear publicación:", error);
        alert("No se pudo publicar. Comprueba tu conexión e inténtalo de nuevo.");
    }
}


/* ==========================================
   EDITAR PUBLICACIÓN
========================================== */

function startEditing(id) {
    if (!isAdmin) return;

    const post = posts.find(item => item.id === id);

    if (!post) return;

    editingPostId = id;

    postContent.value = post.content || "";
    postCategory.value = post.category || "Videojuegos";

    selectedPostImage = post.image || null;

    if (selectedPostImage) {
        imagePreview.src = selectedPostImage;
        imagePreview.hidden = false;
    } else {
        imagePreview.removeAttribute("src");
        imagePreview.hidden = true;
    }

    formTitle.textContent = "Editar publicación";
    submitButton.textContent = "Guardar cambios";
    cancelButton.hidden = false;

    showPage("home");
    postContent.focus();
}


/* ==========================================
   ACTUALIZAR PUBLICACIÓN
========================================== */

async function updatePost(id, content, category, image) {
    if (!isAdmin) return;

    try {
        await updateDoc(doc(db, "posts", id), {
            content,
            category,
            image: image || ""
        });

        resetPostForm();

    } catch (error) {
        console.error("Error al actualizar publicación:", error);
        alert("No se pudieron guardar los cambios.");
    }
}


/* ==========================================
   REINICIAR FORMULARIO
========================================== */

function resetPostForm() {
    editingPostId = null;
    selectedPostImage = null;

    postForm.reset();

    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;

    formTitle.textContent = "Crear publicación";
    submitButton.textContent = "✦ Publicar";
    cancelButton.hidden = true;
}


/* ==========================================
   ELIMINAR PUBLICACIÓN
========================================== */

async function deletePost(id) {
    if (!isAdmin) return;

    const confirmed = confirm(
        "¿Seguro que quieres eliminar esta publicación?"
    );

    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "posts", id));

        if (editingPostId === id) {
            resetPostForm();
        }

    } catch (error) {
        console.error("Error al eliminar publicación:", error);
        alert("No se pudo eliminar la publicación.");
    }
}


/* ==========================================
   MOSTRAR PUBLICACIONES
========================================== */

function renderPosts() {
    postsContainer.innerHTML = "";

    const filteredPosts = currentCategory === "Inicio"
        ? posts
        : posts.filter(post => post.category === currentCategory);

    if (filteredPosts.length === 0) {
        const message = document.createElement("p");
        message.textContent =
            "Todavía no hay publicaciones en esta categoría.";

        postsContainer.appendChild(message);
        return;
    }

    filteredPosts.forEach(post => {
        const article = document.createElement("article");
        article.className = "post";

        // Autor
        const author = document.createElement("div");
        author.className = "post-author";

        if (profile.image) {
            const avatar = document.createElement("img");
            avatar.src = profile.image;
            avatar.alt = "Foto de perfil";
            author.appendChild(avatar);
        }

        const authorName = document.createElement("strong");
        authorName.textContent = profile.name || "Tu nombre";

        author.appendChild(authorName);

        // Categoría
        const category = document.createElement("p");
        category.className = "post-category";
        category.textContent = "Categoría: " + post.category;

        // Texto
        const content = document.createElement("p");
        content.className = "post-content";
        content.textContent = post.content || "";

        article.append(author, category, content);

        // Imagen
        if (post.image) {
            const image = document.createElement("img");
            image.src = post.image;
            image.alt = "Imagen de la publicación";
            image.className = "post-image";

            article.appendChild(image);
        }

        // Fecha
        const date = document.createElement("small");
        const parsedDate = new Date(post.date);

        date.className = "post-date";
        date.textContent = isNaN(parsedDate.getTime())
            ? "Fecha desconocida"
            : parsedDate.toLocaleString("es-MX");

        article.appendChild(date);

        // Acciones exclusivas del administrador
        if (isAdmin) {
            const actions = document.createElement("div");
            actions.className = "post-actions";

            const editButton = document.createElement("button");
            editButton.textContent = "Editar";
            editButton.addEventListener("click", () => {
                startEditing(post.id);
            });

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Eliminar";
            deleteButton.addEventListener("click", () => {
                deletePost(post.id);
            });

            actions.append(editButton, deleteButton);
            article.appendChild(actions);
        }

        postsContainer.appendChild(article);
    });
}


/* ==========================================
   FILTRAR CATEGORÍAS
========================================== */

function filterCategory(category) {
    currentCategory = category;

    categoryButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.category === category
        );
    });

    showPage("home");
    renderPosts();
}

categoryButtons.forEach(button => {
    button.addEventListener("click", function() {
        filterCategory(button.dataset.category);
    });
});


/* ==========================================
   IMÁGENES DE PUBLICACIONES
========================================== */

postImage.addEventListener("change", async function() {
    const file = postImage.files[0];

    if (!file) {
        if (!editingPostId) {
            selectedPostImage = null;
            imagePreview.removeAttribute("src");
            imagePreview.hidden = true;
        }
        return;
    }

    try {
        selectedPostImage = await readImage(file, 350 * 1024);

        imagePreview.src = selectedPostImage;
        imagePreview.hidden = false;

    } catch (error) {
        alert(error.message);

        postImage.value = "";
        selectedPostImage = editingPostId
            ? posts.find(post => post.id === editingPostId)?.image || null
            : null;
    }
});


/* ==========================================
   ENVIAR PUBLICACIÓN
========================================== */

postForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!canPublish()) return;

    if (editingPostId !== null && !isAdmin) {
        alert("Solo el administrador puede editar publicaciones.");
        resetPostForm();
        return;
    }

    const content = postContent.value.trim();
    const category = postCategory.value;

    if (!content) {
        alert("Escribe algo antes de publicar.");
        return;
    }

    if (!validCategories.includes(category)) {
        alert("Selecciona una categoría válida.");
        return;
    }

    submitButton.disabled = true;

    try {
        if (editingPostId !== null) {
            await updatePost(
                editingPostId,
                content,
                category,
                selectedPostImage
            );
        } else {
            await createPost(
                content,
                category,
                selectedPostImage
            );
        }

    } finally {
        submitButton.disabled = false;
    }
});

cancelButton.addEventListener("click", resetPostForm);


/* ==========================================
   PERFIL: ESCUCHAR FIRESTORE
========================================== */

const profileRef = doc(db, "site", "profile");

onSnapshot(profileRef, function(snapshot) {
    if (snapshot.exists()) {
        const data = snapshot.data();

        profile = {
            name: typeof data.name === "string"
                ? data.name
                : "Tu nombre",

            description: typeof data.description === "string"
                ? data.description
                : "",

            age: data.age ?? "",

            image: typeof data.image === "string"
                ? data.image
                : ""
        };
    }

    renderProfile();
    renderPosts();

}, function(error) {
    console.error("Error al cargar perfil:", error);
});


/* ==========================================
   PERFIL: MOSTRAR INFORMACIÓN
========================================== */

function renderProfile() {
    profileName.textContent = profile.name;
    profileDescription.textContent = profile.description;

    profileAge.textContent = profile.age
        ? "Edad: " + profile.age
        : "";

    if (profile.image) {
        profileImage.src = profile.image;
        profileImage.hidden = false;
    } else {
        profileImage.removeAttribute("src");
        profileImage.hidden = true;
    }
}


/* ==========================================
   PERFIL: ABRIR EDITOR
========================================== */

editProfileButton.addEventListener("click", function() {
    if (!isAdmin) return;

    profileNameInput.value = profile.name;
    profileDescriptionInput.value = profile.description;
    profileAgeInput.value = profile.age ?? "";

    profileImageInput.value = "";
    selectedProfileImage = null;

    if (profile.image) {
        profileImagePreview.src = profile.image;
        profileImagePreview.hidden = false;
    } else {
        profileImagePreview.removeAttribute("src");
        profileImagePreview.hidden = true;
    }

    profileForm.hidden = false;
});


/* ==========================================
   PERFIL: VISTA PREVIA DE FOTO
========================================== */

profileImageInput.addEventListener("change", async function() {
    const file = profileImageInput.files[0];

    if (!file) {
        selectedProfileImage = null;
        return;
    }

    try {
        selectedProfileImage = await readImage(file, 200 * 1024);

        profileImagePreview.src = selectedProfileImage;
        profileImagePreview.hidden = false;

    } catch (error) {
        alert(error.message);

        profileImageInput.value = "";
        selectedProfileImage = null;
    }
});


/* ==========================================
   PERFIL: GUARDAR CAMBIOS
========================================== */

profileForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!isAdmin) return;

    const name = profileNameInput.value.trim();
    const description = profileDescriptionInput.value.trim();

    const ageText = profileAgeInput.value.trim();

    let age = "";

    if (ageText !== "") {
        age = Number(ageText);

        if (!Number.isInteger(age) || age < 1 || age > 120) {
            alert("Escribe una edad válida o deja el campo vacío.");
            return;
        }
    }

    if (!name) {
        alert("Escribe un nombre.");
        return;
    }

    const updatedProfile = {
        name,
        description,
        age,
        image: selectedProfileImage !== null
            ? selectedProfileImage
            : profile.image
    };

    const saveButton = profileForm.querySelector(
        'button[type="submit"]'
    );

    saveButton.disabled = true;

    try {
        await setDoc(profileRef, updatedProfile);

        profileForm.hidden = true;
        selectedProfileImage = null;
        profileImageInput.value = "";

    } catch (error) {
        console.error("Error al guardar perfil:", error);
        alert("No se pudo guardar el perfil. Inténtalo de nuevo.");

    } finally {
        saveButton.disabled = false;
    }
});


/* ==========================================
   PERFIL: CANCELAR EDICIÓN
========================================== */

cancelProfileButton.addEventListener("click", function() {
    profileForm.reset();
    profileForm.hidden = true;

    selectedProfileImage = null;

    profileImagePreview.removeAttribute("src");
    profileImagePreview.hidden = true;
});


/* ==========================================
   INICIAR BLOG
========================================== */

setAdminUI();
renderProfile();
renderPosts();
showPage("home");

console.log("Blog conectado con Firebase.");
