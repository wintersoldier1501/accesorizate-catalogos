// CONFIGURACIÓN DE GOOGLE FIREBASE Y IMGBB
// Pega aquí las claves de tu proyecto de Firebase y Imgbb.

window.firebaseConfig = {
  apiKey: "AIzaSyBURy9bxFxxGEz05wJf5uVqratvkrrWf2A",
  authDomain: "catalogos-accesorizate.firebaseapp.com",
  projectId: "catalogos-accesorizate",
  storageBucket: "catalogos-accesorizate.firebasestorage.app",
  messagingSenderId: "233493722970",
  appId: "1:233493722970:web:347134d64062dbb738a563"
};

// Clave API de Imgbb para subida de fotos gratuita y sin tarjeta
window.imgbbApiKey = "493fdacac64bf23ed3a0977692dfe291";

// Indica si la configuración ha sido rellenada
window.isFirebaseConfigured = function() {
    return window.firebaseConfig && 
           window.firebaseConfig.apiKey && 
           window.firebaseConfig.apiKey.trim() !== "" &&
           window.firebaseConfig.projectId &&
           window.firebaseConfig.projectId.trim() !== "";
};
