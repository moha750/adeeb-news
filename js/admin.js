// تهيئة Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCITn-kGZ_IFZ2Xi_8kKLotg6EUSfdtvXM",
  authDomain: "adeeb-club.firebaseapp.com",
  projectId: "adeeb-club",
  storageBucket: "adeeb-club.appspot.com",
  messagingSenderId: "874684085292",
  appId: "1:874684085292:web:275f5065300980790ecd89"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// تهيئة Cloudinary
const CLOUDINARY_CONFIG = {
  cloudName: 'dgewq10jy',
  uploadPreset: 'adeeb news'
};

// متغيرات التطبيق
let isEditing = false;
let currentEditingId = null;
let isDraft = false;

// عناصر واجهة المستخدم
const loginContainer = document.getElementById('loginContainer');
const adminContent = document.getElementById('adminContent');
const logoutBtn = document.getElementById('logoutBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showRegister = document.getElementById('showRegister');
const showLogin = document.getElementById('showLogin');
const loginSection = document.getElementById('loginSection');
const registerSection = document.getElementById('registerSection');
const saveDraftBtn = document.getElementById('saveDraftBtn');
const publishBtn = document.querySelector('button[name="publish"]');
const draftsContainer = document.getElementById('draftsContainer');
const adminNewsContainer = document.getElementById('adminNewsContainer');

// ========== نظام المصادقة ==========
showRegister.addEventListener('click', (e) => {
  e.preventDefault();
  registerSection.style.display = 'block';
  loginSection.style.display = 'none';
});

showLogin.addEventListener('click', (e) => {
  e.preventDefault();
  registerSection.style.display = 'none';
  loginSection.style.display = 'block';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  
  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';
    
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    alert('خطأ في تسجيل الدخول: ' + error.message);
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> تسجيل الدخول';
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  
  try {
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';
    
    await auth.createUserWithEmailAndPassword(email, password);
    alert('تم إنشاء الحساب بنجاح، يمكنك الآن تسجيل الدخول');
    registerSection.style.display = 'none';
    loginSection.style.display = 'block';
  } catch (error) {
    alert('خطأ في إنشاء الحساب: ' + error.message);
    const btn = e.target.querySelector('button');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-user-plus"></i> إنشاء حساب';
  }
});

logoutBtn.addEventListener('click', (e) => {
  e.preventDefault();
  auth.signOut();
});

auth.onAuthStateChanged((user) => {
  if (user) {
    loginContainer.style.display = 'none';
    adminContent.style.display = 'block';
    logoutBtn.style.display = 'block';
    displayAdminNews();
    displayDrafts();
  } else {
    loginContainer.style.display = 'block';
    adminContent.style.display = 'none';
    logoutBtn.style.display = 'none';
  }
});

// ========== نظام المسودات ==========
saveDraftBtn.addEventListener('click', saveNewsDraft);

async function saveNewsDraft() {
  const title = document.getElementById('newsTitle').value.trim();
  const content = document.getElementById('newsContent').value.trim();
  const imageFile = document.getElementById('newsImageFile').files[0];

  if (!title && !content) {
    alert('يجب إدخال عنوان أو محتوى للحفظ كمسودة');
    return;
  }

  try {
    saveDraftBtn.disabled = true;
    saveDraftBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    let imageUrl = null;
    if (imageFile) {
      const compressedFile = await compressImage(imageFile);
      imageUrl = await uploadToCloudinary(compressedFile);
    }

    const draftData = {
      title,
      content,
      imageUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      authorId: auth.currentUser.uid
    };

    if (isEditing && currentEditingId) {
      await db.collection('drafts').doc(currentEditingId).update(draftData);
      alert('تم تحديث المسودة بنجاح');
    } else {
      draftData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('drafts').add(draftData);
      alert('تم حفظ المسودة بنجاح');
    }

    resetForm();
    displayDrafts();
  } catch (error) {
    console.error('Error saving draft:', error);
    alert('حدث خطأ أثناء حفظ المسودة');
  } finally {
    saveDraftBtn.disabled = false;
    saveDraftBtn.innerHTML = 'حفظ كمسودة';
  }
}

async function displayDrafts() {
  draftsContainer.innerHTML = '<div class="loading">جاري تحميل المسودات...</div>';

  try {
    const querySnapshot = await db.collection('drafts')
      .where('authorId', '==', auth.currentUser.uid)
      .orderBy('updatedAt', 'desc')
      .get();

    draftsContainer.innerHTML = '';

    if (querySnapshot.empty) {
      draftsContainer.innerHTML = '<p class="no-items">لا توجد مسودات محفوظة</p>';
      return;
    }

    querySnapshot.forEach(doc => {
      const draft = doc.data();
      const draftEl = document.createElement('div');
      draftEl.className = 'draft-item';
      draftEl.innerHTML = `
        <h3>${draft.title || 'بدون عنوان'}</h3>
        <p>${draft.content ? draft.content.substring(0, 100) + '...' : 'لا يوجد محتوى'}</p>
        ${draft.imageUrl ? `<img src="${draft.imageUrl}" alt="صورة المسودة" class="draft-image">` : ''}
        <div class="draft-meta">
          <small>آخر تعديل: ${formatDate(draft.updatedAt)}</small>
        </div>
        <div class="draft-actions">
          <button onclick="loadDraftToEditor('${doc.id}')">
            <i class="fas fa-edit"></i> تعديل
          </button>
          <button onclick="publishDraft('${doc.id}')">
            <i class="fas fa-paper-plane"></i> نشر
          </button>
          <button onclick="deleteDraft('${doc.id}')">
            <i class="fas fa-trash"></i> حذف
          </button>
        </div>
      `;
      draftsContainer.appendChild(draftEl);
    });
  } catch (error) {
    draftsContainer.innerHTML = '<p class="error">حدث خطأ أثناء تحميل المسودات</p>';
  }
}

window.loadDraftToEditor = async function(draftId) {
  try {
    const doc = await db.collection('drafts').doc(draftId).get();
    if (!doc.exists) return;

    const draft = doc.data();
    document.getElementById('newsTitle').value = draft.title || '';
    document.getElementById('newsContent').value = draft.content || '';
    
    const imagePreview = document.getElementById('imagePreview');
    imagePreview.innerHTML = draft.imageUrl ? 
      `<img src="${draft.imageUrl}" alt="صورة المسودة"><button type="button" class="remove-image" onclick="removeSelectedImage()"><i class="fas fa-times"></i> إزالة الصورة</button>` : 
      '';

    isEditing = true;
    currentEditingId = draftId;
    isDraft = true;
    
    publishBtn.innerHTML = '<i class="fas fa-save"></i> تحديث المسودة';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    alert('حدث خطأ أثناء تحميل المسودة');
  }
};

window.publishDraft = async function(draftId) {
  if (!confirm('هل تريد نشر هذه المسودة كخبر جديد؟')) return;

  try {
    const doc = await db.collection('drafts').doc(draftId).get();
    const draft = doc.data();

    await db.collection('news').add({
      title: draft.title,
      content: draft.content,
      imageUrl: draft.imageUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      viewsCount: 0 // إضافة عداد المشاهدات
    });

    await db.collection('drafts').doc(draftId).delete();
    alert('تم نشر الخبر بنجاح');
    displayDrafts();
    displayAdminNews();
  } catch (error) {
    alert('حدث خطأ أثناء النشر');
  }
};

window.deleteDraft = async function(draftId) {
  if (!confirm('هل تريد حذف هذه المسودة؟')) return;
  
  try {
    await db.collection('drafts').doc(draftId).delete();
    displayDrafts();
    
    if (currentEditingId === draftId) {
      resetForm();
    }
  } catch (error) {
    alert('حدث خطأ أثناء الحذف');
  }
};

// ========== نظام الأخبار والإحصائيات ==========
async function displayAdminNews() {
  try {
    adminNewsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الأخبار...</div>';
    
    const querySnapshot = await db.collection('news').orderBy('createdAt', 'desc').get();
    
    adminNewsContainer.innerHTML = '';
    
    if (querySnapshot.empty) {
      adminNewsContainer.innerHTML = '<p>لا توجد أخبار متاحة</p>';
      return;
    }
    
    for (const doc of querySnapshot.docs) {
      const news = doc.data();
      const newsItem = document.createElement('div');
      newsItem.className = 'admin-news-item';
      newsItem.dataset.id = doc.id;
      
      // الحصول على إحصائيات المشاهدات
      const stats = await getNewsStats(doc.id);
      
      newsItem.innerHTML = `
        <div class="info">
          <h3>${news.title}</h3>
          <p>${news.content.substring(0, 100)}...</p>
          <small>${formatDate(news.createdAt)}</small>
        </div>
        <div class="stats">
          <div class="stat-item">
            <i class="fas fa-eye"></i>
            <span>${stats.totalViews} مشاهدات</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-users"></i>
            <span>${stats.uniqueViews} زائر</span>
          </div>
        </div>
        <div class="actions">
          <button class="edit" onclick="startEditNews('${doc.id}')">
            <i class="fas fa-edit"></i> تعديل
          </button>
          <button class="delete" onclick="confirmDeleteNews('${doc.id}')">
            <i class="fas fa-trash"></i> حذف
          </button>
          <button class="details" onclick="showNewsDetails('${doc.id}')">
            <i class="fas fa-chart-bar"></i> التفاصيل
          </button>
        </div>
      `;
      
      adminNewsContainer.appendChild(newsItem);
    }
  } catch (error) {
    adminNewsContainer.innerHTML = '<p class="error">حدث خطأ أثناء تحميل الأخبار</p>';
  }
}

async function getNewsStats(newsId) {
  try {
    // إجمالي المشاهدات (بدون count())
    const totalQuery = await db.collection('views')
      .where('newsId', '==', newsId)
      .get();
    
    // المشاهدات الفريدة
    const uniqueIPs = [...new Set(totalQuery.docs.map(doc => doc.data().ipAddress))];

    return {
      totalViews: totalQuery.size, // استخدام size بدلاً من count
      uniqueViews: uniqueIPs.length
    };
  } catch (error) {
    console.error("Error getting stats:", error);
    return { totalViews: 0, uniqueViews: 0 };
  }
}

window.showNewsDetails = async function(newsId) {
  const modal = document.createElement('div');
  modal.className = 'stats-modal';
  
  try {
    // الحصول على تفاصيل الخبر
    const newsDoc = await db.collection('news').doc(newsId).get();
    const news = newsDoc.data();

    // الحصول على آخر 50 مشاهدة
    const viewsSnapshot = await db.collection('views')
      .where('newsId', '==', newsId)
      .orderBy('viewedAt', 'desc')
      .limit(50)
      .get();

    let viewsHTML = '<h3>آخر 50 مشاهدة</h3><div class="views-list">';
    
    viewsSnapshot.forEach(doc => {
      const view = doc.data();
      viewsHTML += `
        <div class="view-item">
          <div><strong>الوقت:</strong> ${view.viewedAt.toDate().toLocaleString('ar-EG')}</div>
          <div><strong>IP:</strong> ${view.ipAddress}</div>
          <div><strong>النوع:</strong> ${view.userId ? 'مستخدم مسجل' : 'زائر'}</div>
        </div>
      `;
    });

    modal.innerHTML = `
      <div class="modal-content">
        <h2>${news.title}</h2>
        <div class="stats-summary">
          <div class="stat-box">
            <h4>إجمالي المشاهدات</h4>
            <p>${(await getNewsStats(newsId)).totalViews}</p>
          </div>
          <div class="stat-box">
            <h4>الزوار الفريدون</h4>
            <p>${(await getNewsStats(newsId)).uniqueViews}</p>
          </div>
        </div>
        ${viewsHTML}
        </div>
        <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i> إغلاق
        </button>
      </div>
    `;
  } catch (error) {
    modal.innerHTML = `
      <div class="modal-content">
        <p class="error">حدث خطأ في تحميل التفاصيل</p>
        <button class="close-btn" onclick="this.parentElement.parentElement.remove()">
          <i class="fas fa-times"></i> إغلاق
        </button>
      </div>
    `;
  }

  document.body.appendChild(modal);
};

window.startEditNews = async function(id) {
  try {
    const doc = await db.collection('news').doc(id).get();
    if (!doc.exists) return;

    const news = doc.data();
    document.getElementById('newsTitle').value = news.title;
    document.getElementById('newsContent').value = news.content;
    
    const imagePreview = document.getElementById('imagePreview');
    imagePreview.innerHTML = news.imageUrl ? 
      `<img src="${news.imageUrl}" alt="الصورة الحالية"><button type="button" class="remove-image" onclick="removeSelectedImage()"><i class="fas fa-times"></i> إزالة الصورة</button>` : 
      '';

    isEditing = true;
    currentEditingId = id;
    isDraft = false;
    
    publishBtn.innerHTML = '<i class="fas fa-save"></i> تحديث الخبر';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    alert('حدث خطأ أثناء تحميل الخبر للتعديل');
  }
};

window.confirmDeleteNews = async function(id) {
  if (!confirm('هل أنت متأكد من حذف هذا الخبر؟ سيتم حذف جميع الإحصائيات المرتبطة به.')) return;
  
  try {
    // حذف الخبر
    await db.collection('news').doc(id).delete();
    
    // حذف سجل المشاهدات (اختياري)
    const viewsSnapshot = await db.collection('views').where('newsId', '==', id).get();
    const batch = db.batch();
    viewsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    
    if (currentEditingId === id) {
      resetForm();
    }
    
    alert('تم حذف الخبر وإحصائياته بنجاح');
    displayAdminNews();
  } catch (error) {
    alert('حدث خطأ أثناء حذف الخبر');
  }
};

// ========== وظائف مساعدة ==========
function resetForm() {
  document.getElementById('addNewsForm').reset();
  document.getElementById('imagePreview').innerHTML = '';
  isEditing = false;
  currentEditingId = null;
  isDraft = false;
  publishBtn.innerHTML = '<i class="fas fa-paper-plane"></i> نشر الخبر';
}

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

async function compressImage(file, { quality = 0.7, maxWidth = 800 } = {}) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.src = event.target.result;
      
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now()
          }));
        }, 'image/jpeg', quality);
      };
    };
    reader.readAsDataURL(file);
  });
}

async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  
  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );
    
    if (!response.ok) throw new Error('فشل رفع الصورة');
    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

// معاينة الصورة
document.getElementById('newsImageFile').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const previewContainer = document.getElementById('imagePreview');
  previewContainer.innerHTML = '';
  
  if (!file.type.match('image.*')) {
    previewContainer.innerHTML = '<p class="error">الملف يجب أن يكون صورة</p>';
    e.target.value = '';
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(event) {
    previewContainer.innerHTML = `
      <img src="${event.target.result}" alt="معاينة الصورة">
      <button type="button" class="remove-image" onclick="removeSelectedImage()">
        <i class="fas fa-times"></i> إزالة الصورة
      </button>
    `;
  };
  reader.readAsDataURL(file);
});

window.removeSelectedImage = function() {
  document.getElementById('newsImageFile').value = '';
  document.getElementById('imagePreview').innerHTML = '';
};

// إرسال النموذج
document.getElementById('addNewsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('newsTitle').value.trim();
  const content = document.getElementById('newsContent').value.trim();
  const imageFile = document.getElementById('newsImageFile').files[0];
  
  if (!title || !content) {
    alert('العنوان والمحتوى مطلوبان');
    return;
  }
  
  try {
    publishBtn.disabled = true;
    publishBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
    let imageUrl = null;
    if (imageFile) {
      const compressedFile = await compressImage(imageFile);
      imageUrl = await uploadToCloudinary(compressedFile);
    } else if (isEditing) {
      const doc = await (isDraft ? 
        db.collection('drafts').doc(currentEditingId).get() : 
        db.collection('news').doc(currentEditingId).get());
      imageUrl = doc.data().imageUrl;
    }
    
    const newsData = {
      title,
      content,
      imageUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    if (isEditing) {
      if (isDraft) {
        await db.collection('drafts').doc(currentEditingId).update(newsData);
        alert('تم تحديث المسودة بنجاح');
      } else {
        await db.collection('news').doc(currentEditingId).update(newsData);
        alert('تم تحديث الخبر بنجاح');
      }
    } else {
      newsData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      newsData.viewsCount = 0; // تهيئة عداد المشاهدات
      await db.collection('news').add(newsData);
      alert('تم نشر الخبر بنجاح');
    }
    
    resetForm();
    displayAdminNews();
    displayDrafts();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  } finally {
    publishBtn.disabled = false;
    publishBtn.innerHTML = isEditing ? 
      (isDraft ? '<i class="fas fa-save"></i> تحديث المسودة' : '<i class="fas fa-save"></i> تحديث الخبر') : 
      '<i class="fas fa-paper-plane"></i> نشر الخبر';
  }
});

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', function() {
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'cancel-edit';
  cancelBtn.innerHTML = '<i class="fas fa-times"></i> إلغاء التعديل';
  cancelBtn.onclick = resetForm;
  document.getElementById('addNewsForm').appendChild(cancelBtn);
  
  setInterval(() => {
    cancelBtn.style.display = isEditing ? 'block' : 'none';
  }, 100);
});