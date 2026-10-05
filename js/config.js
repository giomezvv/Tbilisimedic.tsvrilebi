/* ==========================================
   ⚙️ კონფიგურაცია — ყველა მყარად ჩაწერილი მნიშვნელობა ერთ ადგილას
   ========================================== */

// Firebase-ის ვებ-კონფიგურაცია საიდუმლო არ არის — ის ყოველთვის ბრაუზერში ჩანს.
// მონაცემების რეალური დაცვა უზრუნველყოფილია Firestore-ის წესებით (იხ. firestore.rules).
const firebaseConfig = {
    apiKey: "AIzaSyD3lZ4TbCE-ZJY8-UKRL-yL5kBaf7FO1mo",
    authDomain: "stock-n-pipeline.firebaseapp.com",
    projectId: "stock-n-pipeline",
    storageBucket: "stock-n-pipeline.firebasestorage.app",
    messagingSenderId: "670392455162",
    appId: "1:670392455162:web:39df2ce4b3093032041e43",
    measurementId: "G-N75WYC8BT7"
};

// UI-ში ადმინის ფუნქციების ჩვენება. ⚠️ ეს მხოლოდ ინტერფეისს მართავს —
// იგივე სია უნდა იყოს firestore.rules-სა და storage.rules-ში, წინააღმდეგ შემთხვევაში დაცვა არ მუშაობს.
const ADMIN_EMAILS = ["gio.mezvv@gmail.com"];

// ლიდის შემქმნელი ლიდს ხედავს და არედაქტირებს მაშინაც, როცა მფლობელი სხვაა (მაგ. ადმინს გადასცა).
// ⚠️ true მოითხოვს firestore.rules-სა და storage.rules-ში createdByMe()-ს — სხვაგვარად შემქმნელის დაფა შეცდომას აჩვენებს.
const CREATOR_KEEPS_LEAD_ACCESS = true;

const STORAGE_BASE_URL = "https://firebasestorage.googleapis.com/v0/b/stockpipeline-2c77b.firebasestorage.app/o/products%2F";
const storageUrl = fileName => `${STORAGE_BASE_URL}${encodeURIComponent(fileName)}?alt=media`;
const COMPANY_LOGO_URL = storageUrl("mediclogo.png");

const COMPANY = {
    name: "შპს „თბილისი მედიკ“",
    idCode: "404865286",
    address: "ქ. თბილისი, ლუბლიანას ქ. #28ა",
    phone: "2375177",
    email: "info@tbilisimedic.ge",
    bank: "ს.ს. „თიბისი ბანკი“",
    iban: "GE68TB7031036020100007",
    bankCode: "TBCBGE22",
    director: "მაია ზანგურაშვილი"
};

const DEFAULT_USD_RATE = 2.75;

// Firestore-ის დოკუმენტის ლიმიტი 1MB-ია და ფაილები base64-ით ~33%-ით იზრდება,
// ამიტომ ერთი მიმაგრებული ფაილი ამაზე დიდი ვერ იქნება. (ლოკალური რეჟიმი და ტასკები)
const MAX_ATTACHMENT_BYTES = 600 * 1024;

// ლიდის ფაილები Firebase Storage-ში ინახება — იგივე ლიმიტი უნდა იყოს storage.rules-ში (validUpload).
const MAX_STORAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
