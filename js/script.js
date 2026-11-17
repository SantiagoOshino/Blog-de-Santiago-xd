
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
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


/* ==========================================
   CONFIGURACIÓN
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
let profiles = [];

let currentCategory = "Inicio";
let editingPostId = null;

let selectedPostImage = null;
let selectedProfileImage = null;

let profile = {
    name: "Tu nombre",
    description: "Todavía no hay descripción.",
    image: ""
};


/* ==========================================
   PERMISOS
========================================== */

function canPublish() {
    return isAdmin || isCollaborator;
}

function getRole(uid) {
    if (uid === ADMIN_UID) return "Administrador";
    if (COLLABORATOR_UIDS.includes(uid)) return "Colaborador";
    return "Autor";
}

function getCurrentProfile() {
    if (!currentUser) return profile;

    return profiles.find(item => item.id === currentUser.uid) || {
        id: currentUser.uid,
        name: "Nuevo autor",
        description: "Todavía no hay descripción.",
        image: ""
    };
}


/* ==========================================
   ELEMENTOS HTML
========================================== */

// Navegación
const homeLink = document.getElementById("home-link");
const homeNavLink = document.getElementById("home-nav-link");
const profileLink = document.getElementById("profile-link");
const authorsLink = document.getElementById("authors-link");

const homeSection = document.getElementById("home-section");
const profileSection = document.getElementById("profile-section");
const authorsSection = document.getElementById("authors-section");
const authorsContainer = document.getElementById("authors-container");

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
const profileDescriptionInput =
    document.getElementById("profile-description-input");

const profileImageInput = document.getElementById("profile-image-input");
const profileImagePreview =
    document.getElementById("profile-image-preview");

const profileName = document.getElementById("profile-name");
const profileDescription =
    document.getElementById("profile-description");

const profileRole = document.getElementById("profile-role");
const profileImage = document.getElementById("profile-image");

// Autenticación
const adminLoginForm = document.getElementById("admin-login-form");
const adminEmail = document.getElementById("admin-email");
const adminPassword = document.getElementById("admin-password");
const adminLogoutButton =
    document.getElementById("admin-logout-button");

const adminStatus = document.getElementById("admin-status");
const profileAdminControls =
    document.getElementById("profile-admin-controls");


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
    profileAdminControls.hidden = !loggedIn;

    adminLoginForm.hidden = loggedIn;
    adminLogoutButton.hidden = !loggedIn;

    if (!loggedIn) {
        profileForm.hidden = true;
        resetPostForm();
    }
}

function readImage(file, maxSize) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith("image/")) {
            reject(new Error("Selecciona una imagen válida."));
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
        reader.onerror = () => reject(
            new Error("No se pudo leer la imagen.")
        );

        reader.readAsDataURL(file);
    });
}


/* ==========================================
   NAVEGACIÓN
========================================== */

function showPage(page) {
    homeSection.hidden = page !== "home";
    profileSection.hidden = page !== "profile";
    authorsSection.hidden = page !== "authors";

    if (page === "profile") {
        renderProfile();
    }
}

function goHome(event) {
    event.preventDefault();
    showPage("home");
}

homeLink.addEventListener("click", goHome);
homeNavLink.addEventListener("click", goHome);

profileLink.addEventListener("click", function(event) {
    event.preventDefault();

    if (!currentUser || !canPublish()) {
        showMessage(
            adminStatus,
            "Inicia sesión para consultar y editar tu perfil."
        );
        showPage("home");
        return;
    }

    showPage("profile");
});

authorsLink.addEventListener("click", function(event) {
    event.preventDefault();
    showPage("authors");
    renderAuthors();
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


/* ==========================================
   CREAR O RECUPERAR PERFIL
========================================== */

async function ensureUserProfile(user) {
    const newProfileRef = doc(db, "profiles", user.uid);

    try {
        const existingProfile = await getDoc(newProfileRef);

        if (existingProfile.exists()) {
            return;
        }

        let initialProfile = {
            name: "Nuevo autor",
            description: "Todavía no hay descripción.",
            image: ""
        };

        // Recuperar el perfil antiguo del administrador.
        if (user.uid === ADMIN_UID) {
            const oldProfileRef = doc(db, "site", "profile");
            const oldProfile = await getDoc(oldProfileRef);

            if (oldProfile.exists()) {
                const oldData = oldProfile.data();

                initialProfile = {
                    name: oldData.name || "Administrador",
                    description: oldData.description || "",
                    image: oldData.image || ""
                };
            } else {
                initialProfile.name = "Administrador";
            }
        }

        await setDoc(newProfileRef, {
            ...initialProfile,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error("Error al preparar el perfil:", error);
        showMessage(
            adminStatus,
            "No se pudo preparar el perfil. Comprueba las reglas de Firestore."
        );
    }
}

onAuthStateChanged(auth, async function(user) {
    currentUser = user;

    isAdmin = !!user && user.uid === ADMIN_UID;

    isCollaborator = !!user &&
        COLLABORATOR_UIDS.includes(user.uid);

    if (user && !canPublish()) {
        showMessage(adminStatus, "Esta cuenta no tiene permisos.");
        await signOut(auth);
        return;
    }

    if (isAdmin) {
        showMessage(adminStatus, "Sesión iniciada como administrador.");

    } else if (isCollaborator) {
        showMessage(
            adminStatus,
            "Sesión iniciada como colaborador. Puedes publicar y editar tu perfil."
        );

    } else {
        showMessage(adminStatus, "");
    }

    setAdminUI();

    if (user && canPublish()) {
        await ensureUserProfile(user);
    }

    renderProfile();
    renderAuthors();
    renderPosts();
});


/* ==========================================
   ESCUCHAR PERFILES
========================================== */

onSnapshot(collection(db, "profiles"), function(snapshot) {
    profiles = snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
    }));

    renderProfile();
    renderAuthors();
    renderPosts();

}, function(error) {
    console.error("Error al cargar autores:", error);

    authorsContainer.textContent =
        "No se pudieron cargar los perfiles.";
});


/* ==========================================
   MOSTRAR AUTORES
========================================== */

function renderAuthors() {
    authorsContainer.innerHTML = "";

    const sortedProfiles = [...profiles].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "es")
    );

    if (sortedProfiles.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent =
            "Todavía no hay autores registrados.";

        authorsContainer.appendChild(message);
        return;
    }

    sortedProfiles.forEach(authorProfile => {
        const card = document.createElement("article");
        card.className = "author-card";

        const header = document.createElement("div");
        header.className = "author-card-header";

        if (authorProfile.image) {
            const avatar = document.createElement("img");
            avatar.className = "author-avatar";
            avatar.src = authorProfile.image;
            avatar.alt = "Foto de " + (authorProfile.name || "autor");
            header.appendChild(avatar);
        } else {
            const placeholder = document.createElement("div");
            placeholder.className = "author-avatar-placeholder";
            placeholder.textContent = "✦";
            header.appendChild(placeholder);
        }

        const identity = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = authorProfile.name || "Autor";

        const role = document.createElement("span");
        role.className = "author-role";
        role.textContent = getRole(authorProfile.id);

        identity.append(name, role);
        header.appendChild(identity);

        const description = document.createElement("p");
        description.className = "author-description";
        description.textContent =
            authorProfile.description || "Este autor todavía no ha escrito una descripción.";

        card.append(header, description);
        authorsContainer.appendChild(card);
    });
}


/* ==========================================
   ESCUCHAR PUBLICACIONES
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
        "No se pudieron cargar las publicaciones.";
});


/* ==========================================
   CREAR PUBLICACIÓN
========================================== */

async function createPost(content, category, image) {
    if (!canPublish() || !currentUser) return;

    const authorProfile = getCurrentProfile();

    try {
        await addDoc(collection(db, "posts"), {
            content,
            category,
            image: image || "",
            date: new Date().toISOString(),

            authorUid: currentUser.uid,
            authorName: authorProfile.name || "Autor",
            authorImage: authorProfile.image || ""
        });

        resetPostForm();

    } catch (error) {
        console.error("Error al crear publicación:", error);
        alert("No se pudo publicar. Comprueba tu conexión y las reglas de Firestore.");
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
   REINICIAR FORMULARIO DE PUBLICACIÓN
========================================== */

function resetPostForm() {
    editingPostId = null;
    selectedPostImage = null;

    postForm.reset();

    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;

    formTitle.textContent = "Crear publicación";
    submitButton.textContent = "Publicar";
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

        // Buscar el perfil actual del autor.
        const authorUid = post.authorUid || ADMIN_UID;

        const authorProfile = profiles.find(
            item => item.id === authorUid
        );

        const authorName = authorProfile?.name ||
            post.authorName ||
            "Autor";

        const authorImage = authorProfile?.image ||
            post.authorImage ||
            "";

        // Autor
        const author = document.createElement("div");
        author.className = "post-author";

        if (authorImage) {
            const avatar = document.createElement("img");
            avatar.src = authorImage;
            avatar.alt = "Foto de " + authorName;
            author.appendChild(avatar);
        }

        const authorInfo = document.createElement("div");

        const name = document.createElement("strong");
        name.textContent = authorName;

        const role = document.createElement("small");
        role.className = "post-date";
        role.textContent = getRole(authorUid);

        authorInfo.append(name, role);
        author.appendChild(authorInfo);

        // Categoría
        const category = document.createElement("p");
        category.className = "post-category";
        category.textContent = "Categoría: " + post.category;

        // Contenido
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
   MOSTRAR PERFIL PROPIO
========================================== */

function renderProfile() {
    if (!currentUser || !canPublish()) {
        profileName.textContent = "Inicia sesión";
        profileDescription.textContent =
            "Necesitas iniciar sesión para consultar tu perfil.";
        profileRole.textContent = "";
        profileImage.hidden = true;
        return;
    }

    profile = getCurrentProfile();

    profileName.textContent = profile.name || "Nuevo autor";

    profileDescription.textContent =
        profile.description || "Todavía no hay descripción.";

    profileRole.textContent = getRole(currentUser.uid);

    if (profile.image) {
        profileImage.src = profile.image;
        profileImage.hidden = false;
    } else {
        profileImage.removeAttribute("src");
        profileImage.hidden = true;
    }
}


/* ==========================================
   ABRIR EDITOR DE PERFIL
========================================== */

editProfileButton.addEventListener("click", function() {
    if (!canPublish() || !currentUser) return;

    const currentProfile = getCurrentProfile();

    profileNameInput.value = currentProfile.name || "";
    profileDescriptionInput.value =
        currentProfile.description || "";

    profileImageInput.value = "";
    selectedProfileImage = null;

    if (currentProfile.image) {
        profileImagePreview.src = currentProfile.image;
        profileImagePreview.hidden = false;
    } else {
        profileImagePreview.removeAttribute("src");
        profileImagePreview.hidden = true;
    }

    profileForm.hidden = false;
});


/* ==========================================
   VISTA PREVIA DE FOTO DE PERFIL
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
   GUARDAR PERFIL PROPIO
========================================== */

profileForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!canPublish() || !currentUser) return;

    const name = profileNameInput.value.trim();
    const description = profileDescriptionInput.value.trim();

    if (!name) {
        alert("Escribe un nombre.");
        return;
    }

    const currentProfile = getCurrentProfile();

    const updatedProfile = {
        name,
        description,
        image: selectedProfileImage !== null
            ? selectedProfileImage
            : currentProfile.image || ""
    };

    const saveButton = profileForm.querySelector(
        'button[type="submit"]'
    );

    saveButton.disabled = true;

    try {
        await setDoc(
            doc(db, "profiles", currentUser.uid),
            updatedProfile,
            { merge: true }
        );

        profileForm.hidden = true;
        selectedProfileImage = null;
        profileImageInput.value = "";

        showMessage(adminStatus, "Tu perfil se guardó correctamente.");

    } catch (error) {
        console.error("Error al guardar perfil:", error);
        alert("No se pudo guardar el perfil. Comprueba las reglas de Firestore.");

    } finally {
        saveButton.disabled = false;
    }
});


/* ==========================================
   CANCELAR EDICIÓN DE PERFIL
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
renderAuthors();
renderPosts();
showPage("home");

console.log("Blog conectado con Firebase.");
