
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAtx2-uEZVFAAkhxsV8pvs55bfQzwg7vUE",
    authDomain: "mi-blog-7eec2.firebaseapp.com",
    projectId: "mi-blog-7eec2",
    storageBucket: "mi-blog-7eec2.firebasestorage.app",
    messagingSenderId: "600448901457",
    appId: "1:600448901457:web:cae7450f4afcefcba7b370"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
