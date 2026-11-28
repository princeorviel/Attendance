# Attendance — हाज़िरी व सैलरी हिसाब App (PWA)

स्टाफ़ हाज़िरी, सैलरी कैलकुलेटर, एडवांस/पेमेंट लेजर, मल्टी-ब्रांच Shop मैनेजमेंट और ऑफ़लाइन सपोर्ट के साथ **इंस्टॉल होने वाला मोबाइल Web App (PWA)**।

---

## मुख्य फ़ीचर्स (Key Features)

- **100% अलग Multi-Shopkeeper Isolation (पूर्ण डेटा प्राइवेसी):**
  - हर Shopkeeper की Shop, स्टाफ़, हाज़िरी, सैलरी और हिसाब Firestore Security Rules के स्तर पर पूरी तरह अलग रहते हैं।
  - किसी भी दूसरे Shopkeeper या उसके स्टाफ़ को आपकी Shop का नाम, स्टाफ़ या कोई भी डेटा कभी नहीं दिखता और न ही एक्सेस होता है।
  - एक Shopkeeper के अंदर भी हर Staff को केवल अपना खुद का निजी डेटा दिखता है।
- **Multi-Branch / Multiple Shops:** एक ही अकाउंट से एक से ज़्यादा Shops / Branches बनाएं और 1 क्लिक में स्विच करें।
- **Granular Manager Permissions:** Owner किसी भी स्टाफ़ को Manager बनाकर सीमित अधिकार (हाज़िरी, अनुरोध मंज़ूरी, एडवांस/पेमेंट, सैलरी बदलाव, स्टाफ़ जोड़/हटाएं) दे सकता है।
- **Staff Self-Service:** स्टाफ़ GPS लोकेशन व सेल्फ़ी के साथ Punch-In/Out और छुट्टी (Leave) का अनुरोध भेज सकते हैं, जिसे Owner/Manager 1 क्लिक में मंज़ूर या रद्द कर सकते हैं।
- **Salary, Carry-Forward & PDF Ledger:** ऑटोमैटिक महीने की सैलरी गणना, कैरी-फ़ॉरवर्ड बैलेंस, प्रिंट/PDF स्टेटमेंट और इन-ऐप / WhatsApp शेयर।
- **Shop व Shopkeeper ID Delete:** Owner किसी एक Shop को या अपनी पूरी Shopkeeper ID को 2-step कन्फ़र्मेशन के साथ हमेशा के लिए डिलीट कर सकता है।
- **Mobile App (PWA) + Offline Mode:** Android, iPhone और Desktop पर होम स्क्रीन ऐप की तरह इंस्टॉल होता है, Home Screen Shortcuts सपोर्ट करता है और ऑफ़लाइन भी चलता है।

---

## लोकल सेटअप (Local Setup)

```bash
npm install
npm run dev
```

प्रोडक्शन बिल्ड और TypeScript जाँच के लिए:

```bash
npm run lint
npm run build
```

---

## GitHub पर कैसे डालें और Live होस्ट करें

### 1. GitHub Repository में Push करें

```bash
git init
git add .
git commit -m "Initial Attendance PWA release"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git
git push -u origin main
```

हर `push` पर `.github/workflows/build-and-deploy.yml` अपने-आप:
1. TypeScript चेक और Production PWA build (`dist/`) तैयार करता है।
2. इंस्टॉल होने वाला **Android APK (`Attendance-App.apk`)** बनाकर **GitHub Releases** और **Actions → Artifacts** में अपलोड कर देता है।

### Android APK सीधे GitHub से कैसे डाउनलोड करें

1. अपनी GitHub रिपॉजिटरी के **Releases** सेक्शन में जाएं (`Attendance App (Latest Android APK)`) और नीचे **Assets → `Attendance-App.apk`** पर टैप करके सीधे डाउनलोड व इंस्टॉल करें।
2. या **Actions → Build & Release Attendance App** के हरे (✅) रन के अंदर नीचे **Artifacts → `Attendance-App-APK`** से डाउनलोड करें।

> **नोट:** Offline / Local Mode APK में तुरंत चलता है। **Google Login व Cloud Shop Sync** के लिए ऐप को Vercel/Netlify के Live HTTPS लिंक पर खोलकर Chrome से **Install app** करना सबसे बेहतर है।

### 2. Live Web App होस्ट करें (Vercel / Netlify / Firebase Hosting)

- **Vercel / Netlify:** अपनी GitHub रिपॉजिटरी जोड़ें → Build Command `npm run build` और Output Directory `dist` रखें → Deploy करें।
- **Firebase Auth Domain जोड़ें (ज़रूरी):**
  - अपने लाइव डोमेन (जैसे `your-app.vercel.app`) को **Firebase Console → Authentication → Settings → Authorized domains** में ज़रूर जोड़ें, ताकि Google Login काम करे।
- **Firestore Rules Deploy करें:**
  ```bash
  firebase deploy --only firestore:rules
  ```

---

## Play Store (.aab) कैसे बनाएं

क्योंकि यह ऐप पूर्ण **PWA Manifest + Service Worker + Maskable Icons** के साथ तैयार है:

1. अपनी लाइव वेबसाइट का HTTPS URL कॉपी करें।
2. [PWABuilder.com](https://www.pwabuilder.com) पर जाकर अपना URL डालें।
3. **Package for Stores → Android** चुनें और **Signed APK / Google Play AAB** डाउनलोड करें।

---

## फ्री Website + Google AdSense से कमाई कैसे चालू करें

इस ऐप में AdSense अप्रूवल के लिए ज़रूरी **ऐप के बारे में (About), प्राइवेसी पॉलिसी (Privacy Policy), नियम व शर्तें (Terms), संपर्क (Contact)**, `public/ads.txt` और ऑटोमैटिक रिस्पॉन्सिव Ad बैनर पहले से तैयार हैं:

1. **Vercel पर फ्री Live करें:** [vercel.com](https://vercel.com) पर अपने GitHub रेपो (`Attendance`) को Import करके Deploy करें (फ्री)।
2. **Google AdSense पर Apply करें:** [adsense.google.com](https://www.google.com/adsense) पर अपनी साइट जोड़ें।
3. **Publisher ID जोड़ें:** Vercel → Project Settings → **Environment Variables** में ये 2 वैल्यू डालकर Redeploy करें:
   - `VITE_ADSENSE_CLIENT_ID` = `ca-pub-xxxxxxxxxxxxxxxx` (आपका Publisher ID)
   - `VITE_ADSENSE_SLOT_MAIN` = आपका Display Ad Unit Slot ID
4. **`public/ads.txt` अपडेट करें:** `public/ads.txt` में अपना `pub-xxxxxxxxxxxxxxxx` नंबर डालकर GitHub पर Push कर दें। इसके बाद ऐप में अपने-आप असली Ads दिखने लगेंगे।

---

## सुरक्षा (Security Note)

सभी Firestore Security Rules `/firestore.rules` में परिभाषित हैं। ऐप को बड़े स्तर पर पब्लिश करने से पहले अपनी आवश्यकताओं के अनुसार `firestore.rules` की समीक्षा ज़रूर करें।
