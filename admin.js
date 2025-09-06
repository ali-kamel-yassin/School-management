// assets/js/admin.js

// متغيرات عامة
let schools = [];

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    fetchSchools();
    setupEventListeners();
});

// إعداد الأحداث
function setupEventListeners() {
    document.getElementById('addSchoolForm')?.addEventListener('submit', addSchool);
}

// جلب قائمة المدارس
async function fetchSchools() {
    try {
        const response = await fetch('/api/schools');
        schools = await response.json();
        renderSchoolsTable();
    } catch (error) {
        console.error('Error fetching schools:', error);
        alert('حدث خطأ في جلب بيانات المدارس');
    }
}

// عرض جدول المدارس
function renderSchoolsTable() {
    const tbody = document.getElementById('schoolsTableBody');
    if (!tbody) return;

    tbody.innerHTML = schools.map((school, index) => `
        <tr data-id="${school.id}">
            <td>${index + 1}</td>
            <td>
                <input type="text" class="edit-name" value="${school.name}" 
                       onchange="updateSchoolField(${school.id}, 'name', this.value)">
            </td>
            <td>${school.code}</td>
            <td>
                <select class="edit-study-type" onchange="updateSchoolField(${school.id}, 'study_type', this.value)">
                    <option value="صباحي" ${school.study_type === 'صباحي' ? 'selected' : ''}>صباحي</option>
                    <option value="مسائي" ${school.study_type === 'مسائي' ? 'selected' : ''}>مسائي</option>
                </select>
            </td>
            <td>
                <select class="edit-level" onchange="updateSchoolField(${school.id}, 'level', this.value)">
                    <option value="ابتدائي" ${school.level === 'ابتدائي' ? 'selected' : ''}>ابتدائي</option>
                    <option value="متوسطة" ${school.level === 'متوسطة' ? 'selected' : ''}>متوسطة</option>
                    <option value="ثانوية" ${school.level === 'ثانوية' ? 'selected' : ''}>ثانوية</option>
                    <option value="إعدادية" ${school.level === 'إعدادية' ? 'selected' : ''}>إعدادية</option>
                </select>
            </td>
            <td>
                <select class="edit-gender-type" onchange="updateSchoolField(${school.id}, 'gender_type', this.value)">
                    <option value="بنين" ${school.gender_type === 'بنين' ? 'selected' : ''}>بنين</option>
                    <option value="بنات" ${school.gender_type === 'بنات' ? 'selected' : ''}>بنات</option>
                    <option value="مختلطة" ${school.gender_type === 'مختلطة' ? 'selected' : ''}>مختلطة</option>
                </select>
            </td>
            <td>
                <button class="action-btn btn-save" onclick="saveSchool(${school.id})">
                    <i class="fas fa-save"></i>
                </button>
                <button class="action-btn btn-delete" onclick="deleteSchool(${school.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// إضافة مدرسة جديدة
async function addSchool(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const schoolData = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/schools', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(schoolData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            e.target.reset();
            fetchSchools();
            showNotification(`تم إضافة المدرسة بنجاح! رمز المدرسة: ${result.code}`, 'success');
        } else {
            alert(result.error || 'حدث خطأ في إضافة المدرسة');
        }
    } catch (error) {
        console.error('Error adding school:', error);
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

// تحديث حقل في المدرسة
async function updateSchoolField(id, field, value) {
    const school = schools.find(s => s.id === id);
    if (school) {
        school[field] = value;
    }
}

// حفظ تغييرات المدرسة
async function saveSchool(id) {
    const school = schools.find(s => s.id === id);
    if (!school) return;

    try {
        const response = await fetch(`/api/schools/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(school)
        });

        const result = await response.json();
        
        if (response.ok) {
            showNotification('تم تحديث المدرسة بنجاح', 'success');
        } else {
            alert(result.error || 'حدث خطأ في تحديث المدرسة');
        }
    } catch (error) {
        console.error('Error saving school:', error);
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

// حذف مدرسة
async function deleteSchool(id) {
    if (!confirm('هل أنت متأكد من حذف هذه المدرسة وجميع طلابها؟')) return;

    try {
        const response = await fetch(`/api/schools/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        
        if (response.ok) {
            fetchSchools();
            showNotification('تم حذف المدرسة بنجاح', 'success');
        } else {
            alert(result.error || 'حدث خطأ في حذف المدرسة');
        }
    } catch (error) {
        console.error('Error deleting school:', error);
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

// إشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000); // عرض لمدة 5 ثواني لقراءة الرمز
}

// تسجيل الخروج
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
    }
}