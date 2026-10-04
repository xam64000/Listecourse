import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging"; // NOUVEAU: Import des notifications
import {
  ShoppingBasket,
  Check,
  Trash2,
  Copy,
  ArrowRight,
  Plus,
} from "lucide-react";

const appId = typeof __app_id !== "undefined" ? __app_id : "foubmonky-app";
const firebaseConfig = {
  apiKey: "AIzaSyDIlEnsv7P8NP5lnPSeGWBHSZF5aq1ef5E",
  authDomain: "listecoursefoubmonkyfamily.firebaseapp.com",
  projectId: "listecoursefoubmonkyfamily",
  storageBucket: "listecoursefoubmonkyfamily.firebasestorage.app",
  messagingSenderId: "387519063176",
  appId: "1:387519063176:web:c8a0be8c8c425fa59e6b3d",
};

let app, auth, db, messaging;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  // Initialisation de la messagerie uniquement si le navigateur le supporte
  if (typeof window !== "undefined" && "Notification" in window) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.error("Erreur d'initialisation Firebase:", error);
}

const guessEmoji = (text) => {
  const lowerText = text.toLowerCase();
  const emojiMap = {
    lait: "🥛",
    pain: "🥖",
    baguette: "🥖",
    oeuf: "🥚",
    oeufs: "🥚",
    pomme: "🍎",
    banane: "🍌",
    tomate: "🍅",
    fromage: "🧀",
    poulet: "🍗",
    viande: "🥩",
    poisson: "🐟",
    carotte: "🥕",
    chocolat: "🍫",
    café: "☕",
    bière: "🍺",
    vin: "🍷",
    eau: "💧",
    pâtes: "🍝",
    pizza: "🍕",
    salade: "🥗",
    patate: "🥔",
    oignon: "🧅",
    ail: "🧄",
    fraise: "🍓",
    citron: "🍋",
    avocat: "🥑",
    beurre: "🧈",
    gâteau: "🍰",
    glace: "🍦",
    papier: "🧻",
    pq: "🧻",
    savon: "🧼",
    lessive: "🫧",
    couches: "👶",
    dentifrice: "🪥",
    shampoing: "🧴",
    miel: "🍯",
    jus: "🧃",
    chips: "🥔",
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (lowerText.includes(key)) return emoji;
  }
  return "🛍️"; // Default fun emoji
};

const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
};

export default function App() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [newItemText, setNewItemText] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const listEndRef = useRef(null);

  // Initialisation Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (
          typeof __initial_auth_token !== "undefined" &&
          __initial_auth_token
        ) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Erreur d'auth:", err);
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const hash = window.location.hash.replace("#", "");
        if (hash && hash.length === 5) {
          setRoomCode(hash.toUpperCase());
        } else {
          const newCode = generateRoomCode();
          setRoomCode(newCode);
          window.location.hash = newCode;
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // NOUVEAU : Configuration des Notifications Push
  useEffect(() => {
    if (!user || !messaging) return;

    let unsubscribeMessages;

    const setupNotifications = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // TODO: Remplacer par votre vraie clé VAPID depuis Firebase > Paramètres > Cloud Messaging
          const currentToken = await getToken(messaging, {
            vapidKey: "VOTRE_CLE_VAPID_ICI",
          });

          if (currentToken) {
            console.log("Notifications activées ! Token:", currentToken);
          }
        }
      } catch (error) {
        console.log(
          "Erreur lors de la configuration des notifications:",
          error
        );
      }
    };

    setupNotifications();

    // Écoute les notifications quand l'application est ouverte
    unsubscribeMessages = onMessage(messaging, (payload) => {
      if (Notification.permission === "granted") {
        new Notification(payload.notification?.title || "FoubMonky", {
          body: payload.notification?.body || "La liste a été mise à jour !",
          icon: "🐵",
        });
      }
    });

    return () => {
      if (unsubscribeMessages) unsubscribeMessages();
    };
  }, [user]);

  // Synchronisation des items
  useEffect(() => {
    if (!user || !roomCode) return;

    setLoading(true);
    const collectionName = `foubmonky_${roomCode}`;
    const listRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      collectionName
    );

    const unsubscribe = onSnapshot(
      listRef,
      (snapshot) => {
        const fetchedItems = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        fetchedItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setItems(fetchedItems);
        setLoading(false);
      },
      (err) => {
        console.error("Erreur sync:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, roomCode]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || !user || !roomCode) return;

    const text = newItemText.trim();
    setNewItemText("");

    const collectionName = `foubmonky_${roomCode}`;
    const listRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      collectionName
    );

    try {
      await addDoc(listRef, {
        text: text,
        emoji: guessEmoji(text),
        bought: false,
        createdAt: Date.now(),
        addedBy: user.uid,
      });
      listEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      console.error("Erreur ajout:", err);
    }
  };

  const toggleItem = async (item) => {
    if (!user || !roomCode) return;
    const itemRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      `foubmonky_${roomCode}`,
      item.id
    );
    await updateDoc(itemRef, { bought: !item.bought });
  };

  const deleteItem = async (id) => {
    if (!user || !roomCode) return;
    const itemRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      `foubmonky_${roomCode}`,
      id
    );
    await deleteDoc(itemRef);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinCode.trim().length === 5) {
      const code = joinCode.trim().toUpperCase();
      setRoomCode(code);
      window.location.hash = code;
      setJoinCode("");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 flex items-center justify-center font-sans">
        <div className="animate-bounce flex flex-col items-center">
          <span className="text-6xl mb-4">🐵</span>
          <h1 className="text-white text-3xl font-black tracking-widest drop-shadow-md">
            Chargement...
          </h1>
        </div>
      </div>
    );
  }

  const unboughtItems = items.filter((i) => !i.bought);
  const boughtItems = items.filter((i) => i.bought);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 font-sans p-2 sm:p-6 flex justify-center items-center overflow-hidden relative">
      {/* Decorative background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-yellow-400 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
      <div className="absolute top-[20%] right-[-10%] w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-10%] left-[20%] w-80 h-80 bg-green-400 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md bg-white/95 backdrop-blur-xl border-4 border-white shadow-[0_20px_0_0_rgba(0,0,0,0.1)] rounded-[3rem] flex flex-col h-[95vh] sm:h-[85vh] overflow-hidden relative z-10">
        {/* Colorful Header */}
        <div className="p-6 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 text-white shrink-0 rounded-t-[2.7rem] relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4yKSIvPjwvc3ZnPg==')] opacity-50"></div>

          <h1 className="text-3xl sm:text-4xl font-black text-center mb-4 flex items-center justify-center gap-2 drop-shadow-lg tracking-tight animate-bounce-slow">
            <span className="text-4xl filter drop-shadow-md">🐵</span>
            FoubMonky
          </h1>

          <div className="flex flex-col sm:flex-row gap-3 relative z-10">
            {/* Room Code Display */}
            <div className="flex-1 flex items-center justify-between bg-white/20 backdrop-blur-md p-2 pl-4 rounded-2xl border-2 border-white/40 shadow-inner">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                  Code Secret
                </span>
                <span className="text-2xl font-black text-white tracking-widest">
                  {roomCode}
                </span>
              </div>
              <button
                onClick={copyCode}
                className="p-3 bg-white rounded-xl shadow-[0_4px_0_0_rgba(0,0,0,0.2)] active:shadow-none active:translate-y-1 transition-all text-pink-500 hover:text-pink-600"
                title="Copier le code"
              >
                {copied ? (
                  <Check size={20} strokeWidth={3} className="text-green-500" />
                ) : (
                  <Copy size={20} strokeWidth={3} />
                )}
              </button>
            </div>

            {/* Join Room Form */}
            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                maxLength={5}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Code..."
                className="w-24 bg-white/90 border-2 border-white/50 rounded-2xl px-3 py-2 text-lg font-black text-pink-600 placeholder:text-pink-300 focus:outline-none focus:ring-4 focus:ring-white/50 uppercase text-center shadow-inner"
              />
              <button
                type="submit"
                disabled={joinCode.length !== 5}
                className="bg-green-400 text-white p-3 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500 shadow-[0_4px_0_0_#22c55e] active:shadow-none active:translate-y-1 transition-all flex items-center justify-center"
              >
                <ArrowRight size={20} strokeWidth={3} />
              </button>
            </form>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-gray-50/50">
          <div ref={listEndRef} />

          {loading ? (
            <div className="text-center py-10 font-black text-pink-400 animate-pulse text-xl">
              Recherche des courses... 🍌
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center h-full">
              <div className="text-7xl mb-6 animate-bounce-slow filter drop-shadow-xl">
                🛒
              </div>
              <p className="text-xl font-black text-gray-400">
                Rien à acheter !
              </p>
              <p className="text-sm font-bold text-gray-300 mt-2">
                Ajoute des trucs en bas 👇
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Unbought Items */}
              {unboughtItems.map((item, index) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 bg-white p-3 sm:p-4 rounded-[1.5rem] shadow-[0_6px_0_0_rgba(0,0,0,0.05)] border-2 border-gray-100 animate-pop-in hover:border-pink-200 transition-colors"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-pink-400 flex-shrink-0 hover:bg-pink-100 transition-colors active:scale-90"
                  />
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0 shadow-inner">
                    {item.emoji}
                  </div>
                  <span className="flex-1 text-lg sm:text-xl font-black text-gray-700 break-words leading-tight">
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-100 sm:opacity-0 group-hover:opacity-100 active:scale-90"
                  >
                    <Trash2 size={24} strokeWidth={2.5} />
                  </button>
                </div>
              ))}

              {/* Bought Items Divider */}
              {boughtItems.length > 0 && (
                <div className="pt-6 pb-2">
                  <div className="flex items-center gap-4">
                    <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      Dans le panier 🎉
                    </span>
                    <div className="h-1 flex-1 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              )}

              {/* Bought Items */}
              {boughtItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 bg-gray-100 p-3 sm:p-4 rounded-[1.5rem] border-2 border-transparent opacity-60 hover:opacity-100 transition-opacity"
                >
                  <button
                    onClick={() => toggleItem(item)}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-400 shadow-[0_4px_0_0_#22c55e] flex items-center justify-center flex-shrink-0 text-white active:translate-y-1 active:shadow-none transition-all"
                  >
                    <Check size={24} strokeWidth={4} />
                  </button>
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-200 rounded-full flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0 grayscale">
                    {item.emoji}
                  </div>
                  <span className="flex-1 text-lg sm:text-xl font-bold text-gray-400 line-through break-words">
                    {item.text}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                  >
                    <Trash2 size={24} strokeWidth={2.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="p-4 sm:p-6 bg-white border-t-4 border-gray-100 shrink-0 z-20 rounded-b-[2.7rem]">
          <form onSubmit={handleAddItem} className="relative flex gap-3">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ex: Lait, Bananes..."
              className="flex-1 bg-gray-50 border-2 border-gray-200 rounded-[1.5rem] py-4 px-6 text-xl text-gray-800 font-black placeholder:text-gray-300 focus:outline-none focus:border-cyan-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(34,211,238,0.2)] transition-all"
            />
            <button
              type="submit"
              disabled={!newItemText.trim()}
              className="w-16 flex items-center justify-center bg-cyan-400 text-white rounded-[1.5rem] shadow-[0_6px_0_0_#0891b2] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none hover:bg-cyan-500 active:shadow-none active:translate-y-[6px] transition-all"
            >
              <Plus size={32} strokeWidth={4} />
            </button>
          </form>
        </div>
      </div>

      {/* Global Styles for Animations & Scrollbar */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
        
        @keyframes pop-in {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          70% { transform: scale(1.02) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-pop-in {
          animation: pop-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 3s infinite ease-in-out;
        }

        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `,
        }}
      />
    </div>
  );
}
