import {initializeApp,getApp,getApps} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js';
import {getAuth,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js';
import {firebaseConfig} from '../assets/js/firebase-config.js';
import {apiRequest} from '../assets/js/api.js';
import {mountEditor} from './ui.js';
const auth=getAuth(getApps().length?getApp():initializeApp(firebaseConfig));
const ui=mountEditor({request:(action,payload)=>apiRequest(auth.currentUser,action,payload),logout:async()=>{await signOut(auth);location.href='../ho-so/login.html';}});
onAuthStateChanged(auth,user=>{ui.clear();if(!user||user.isAnonymous){location.replace('../ho-so/login.html?next='+encodeURIComponent('/dang-bai/'));return;}ui.connect(user.displayName||user.email,user.uid);});
