// تهيئة Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCITn-kGZ_IFZ2Xi_8kKLotg6EUSfdtvXM",
  authDomain: "adeeb-club.firebaseapp.com",
  projectId: "adeeb-club",
  storageBucket: "adeeb-club.firebasestorage.app",
  messagingSenderId: "874684085292",
  appId: "1:874684085292:web:275f5065300980790ecd89"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// عرض الأخبار
function displayNews() {
    const newsContainer = document.getElementById('newsContainer');
    
    db.collection('news').orderBy('createdAt', 'desc').get()
        .then((querySnapshot) => {
            newsContainer.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const news = doc.data();
                const newsCard = `
                    <div class="news-card">
                        ${news.imageUrl ? `<img src="${news.imageUrl}" alt="${news.title}">` : ''}
                        <div class="news-card-content">
                            <h3>${news.title}</h3>
                            <p>${news.content.substring(0, 100)}...</p>
                            <a href="news.html?id=${doc.id}">قراءة المزيد</a>
                        </div>
                    </div>
                `;
                newsContainer.innerHTML += newsCard;
            });
        })
        .catch((error) => {
            console.error("Error getting news: ", error);
            newsContainer.innerHTML = '<p>حدث خطأ أثناء تحميل الأخبار</p>';
        });
}

// تشغيل الدالة عند تحميل الصفحة
window.onload = displayNews;