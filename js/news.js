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
const auth = firebase.auth();

// متغيرات التطبيق
let currentUserRating = 0;
let newsId = null;

// عرض الخبر المفرد
async function displaySingleNews() {
    const urlParams = new URLSearchParams(window.location.search);
    newsId = urlParams.get('id');
    const newsArticle = document.getElementById('newsArticle');
    const commentsSection = document.getElementById('commentsSection');

    if (!newsId) {
        newsArticle.innerHTML = '<p>لم يتم العثور على الخبر</p>';
        return;
    }

    try {
        const doc = await db.collection('news').doc(newsId).get();

        if (doc.exists) {
            const news = doc.data();
            const articleContent = `
                <h2>${news.title}</h2>
                ${news.imageUrl ? `<img src="${news.imageUrl}" alt="${news.title}" class="news-image">` : ''}
                <div class="news-meta">
                    <span class="news-date">${formatDate(news.createdAt)}</span>
                </div>
                <div class="news-content">${news.content}</div>
            `;
            newsArticle.innerHTML = articleContent;
            commentsSection.style.display = 'block';

            // تحميل التعليقات والتقييمات
            await loadComments();
            await loadRatings();
        } else {
            newsArticle.innerHTML = '<p>لم يتم العثور على الخبر</p>';
        }
    } catch (error) {
        console.error("Error getting news: ", error);
        newsArticle.innerHTML = '<p class="error">حدث خطأ أثناء تحميل الخبر</p>';
    }


}

// تنسيق التاريخ
function formatDate(timestamp) {
    if (!timestamp) return 'تاريخ غير معروف';
    const date = timestamp.toDate();
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// تحميل التعليقات
async function loadComments() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) {
        console.error('تعذر العثور على عنصر commentsList');
        return;
    }

    commentsList.innerHTML = '<div class="loading">جاري تحميل التعليقات...</div>';

    try {
        const querySnapshot = await db.collection('comments')
            .where('newsId', '==', newsId)
            .orderBy('createdAt', 'desc')
            .get();

        commentsList.innerHTML = '';

        if (querySnapshot.empty) {
            commentsList.innerHTML = '<p class="no-comments">لا توجد تعليقات بعد. كن أول من يعلق!</p>';
            document.getElementById('commentsCount').textContent = '(0)';
            return;
        }

        document.getElementById('commentsCount').textContent = `(${querySnapshot.size})`;

        querySnapshot.forEach(doc => {
            const comment = doc.data();
            const commentElement = document.createElement('div');
            commentElement.className = 'comment-item';
            commentElement.innerHTML = `
                <div class="comment-header">
                    <span class="comment-author">${comment.userName || 'مجهول'}</span>
                    <span class="comment-date">${formatDate(comment.createdAt)}</span>
                </div>
                <div class="comment-text">${comment.text}</div>
            `;
            commentsList.appendChild(commentElement);
        });
    } catch (error) {
        console.error("Error loading comments: ", error);
        commentsList.innerHTML = '<p class="error">حدث خطأ أثناء تحميل التعليقات</p>';
    }
}

// تحميل التقييمات
async function loadRatings() {
    try {
        const ratingsSnapshot = await db.collection('ratings')
            .where('newsId', '==', newsId)
            .get();

        let total = 0;
        ratingsSnapshot.forEach(doc => {
            total += doc.data().rating;
        });

        const average = ratingsSnapshot.size > 0 ? (total / ratingsSnapshot.size).toFixed(1) : 0;
        const ratingElement = document.querySelector('.average-rating');
        if (ratingElement) {
            ratingElement.textContent = `التقييم العام: ${average} من 5 (${ratingsSnapshot.size} تقييمات)`;
        }

        const stars = document.querySelectorAll('.rating-stars span');
        stars.forEach(star => {
            star.textContent = '☆';
            star.style.color = '#ddd';
        });

        auth.onAuthStateChanged(user => {
            if (user) {
                checkUserRating(user.uid);
            }
        });
    } catch (error) {
        console.error("Error loading ratings: ", error);
    }
}

// التحقق من تقييم المستخدم
async function checkUserRating(userId) {
    try {
        const userRatingSnapshot = await db.collection('ratings')
            .where('newsId', '==', newsId)
            .where('userId', '==', userId)
            .get();

        if (!userRatingSnapshot.empty) {
            currentUserRating = userRatingSnapshot.docs[0].data().rating;
            highlightStars(currentUserRating);
        }
    } catch (error) {
        console.error("Error checking user rating: ", error);
    }
}

// تمييز النجوم حسب التقييم
function highlightStars(rating) {
    const stars = document.querySelectorAll('.rating-stars span');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.textContent = '★';
            star.style.color = '#ffc107';
        } else {
            star.textContent = '☆';
            star.style.color = '#ddd';
        }
    });
}

// إرسال تعليق جديد
document.getElementById('commentForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const userName = document.getElementById('commentName').value.trim();
    const commentText = document.getElementById('commentText').value.trim();

    if (!userName || !commentText) {
        alert('الرجاء إدخال اسمك وتعليقك');
        return;
    }

    try {
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        await db.collection('comments').add({
            newsId,
            userName,
            text: commentText,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            userId: auth.currentUser?.uid || null
        });

        document.getElementById('commentForm').reset();
        await loadComments();
    } catch (error) {
        console.error("Error adding comment: ", error);
        alert('حدث خطأ أثناء إضافة التعليق');
    } finally {
        const btn = e.target.querySelector('button');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'إرسال التعليق';
        }
    }
});

// إضافة تقييم
document.querySelector('.rating-stars')?.addEventListener('click', async (e) => {
    if (e.target.tagName !== 'SPAN') return;

    const rating = parseInt(e.target.dataset.value);
    if (isNaN(rating)) return;

    try {
        const user = auth.currentUser;
        if (!user) {
            alert('الرجاء تسجيل الدخول لتتمكن من التقييم');
            return;
        }

        // حذف التقييم القديم إذا وجد
        const userRatingSnapshot = await db.collection('ratings')
            .where('newsId', '==', newsId)
            .where('userId', '==', user.uid)
            .get();

        const batch = db.batch();
        userRatingSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // إضافة التقييم الجديد
        const ratingRef = db.collection('ratings').doc();
        batch.set(ratingRef, {
            newsId,
            userId: user.uid,
            rating,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        currentUserRating = rating;
        highlightStars(rating);
        await loadRatings();
    } catch (error) {
        console.error("Error submitting rating: ", error);
        alert('حدث خطأ أثناء حفظ التقييم');
    }
});

// دالة تسجيل المشاهدة
async function recordView() {
    try {
        const newsId = new URLSearchParams(window.location.search).get('id');
        if (!newsId) return;

        // الحصول على معلومات الزائر
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        const ipAddress = ipData.ip;



        await db.collection('views').add({
            newsId,
            userId: auth.currentUser?.uid || null,
            ipAddress,
            viewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent
        });

        // تحديث عداد المشاهدات في الخبر (اختياري)
        await db.collection('news').doc(newsId).update({
            viewsCount: firebase.firestore.FieldValue.increment(1)
        });
    } catch (error) {
        console.error("Error recording view:", error);
    }
}

window.onload = async () => {
    await displaySingleNews();
    await recordView();
};