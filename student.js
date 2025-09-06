// assets/js/student.js

let currentStudent = null;

// تهيئة الصفحة
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupEventListeners();
});

// إعداد الأحداث
function setupEventListeners() {
    document.getElementById('studentLoginForm')?.addEventListener('submit', loginStudent);
}

// التحقق من حالة تسجيل الدخول
function checkLoginStatus() {
    const student = localStorage.getItem('student');
    if (student) {
        currentStudent = JSON.parse(student);
        showPortal();
        displayStudentData();
    }
}

// تسجيل دخول الطالب
async function loginStudent(e) {
    e.preventDefault();
    
    const code = document.getElementById('studentCode').value;
    
    try {
        const response = await fetch('/api/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });
        
        const result = await response.json();
        
        if (result.error) {
            alert(result.error);
        } else {
            currentStudent = result.student;
            localStorage.setItem('student', JSON.stringify(currentStudent));
            showPortal();
            displayStudentData();
        }
    } catch (error) {
        alert('حدث خطأ في الاتصال بالخادم');
    }
}

// عرض بوابة الطالب
function showPortal() {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('portalSection').style.display = 'block';
    document.getElementById('studentName').textContent = currentStudent.full_name;
}

// عرض بيانات الطالب
function displayStudentData() {
    displayScores();
    displayAttendance();
}

// عرض الدرجات
function displayScores() {
    const scores = parseJSON(currentStudent.scores);
    const tbody = document.getElementById('scoresTableBody');
    
    if (!tbody) return;

    const rows = Object.entries(scores).map(([subject, score]) => `
        <tr>
            <td>${subject}</td>
            <td>${score}</td>
            <td><span class="grade-${getGradeClass(score)}">${getGradeText(score)}</span></td>
        </tr>
    `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="3">لا توجد درجات مسجلة</td></tr>';
}

// عرض الحضور
function displayAttendance() {
    const attendance = parseJSON(currentStudent.attendance);
    const tbody = document.getElementById('attendanceTableBody');
    
    if (!tbody) return;

    const sortedDates = Object.keys(attendance).sort().reverse();
    
    const rows = sortedDates.map(date => `
        <tr>
            <td>${formatDate(date)}</td>
            <td><span class="status-${attendance[date] ? 'present' : 'absent'}">
                ${attendance[date] ? 'حاضر' : 'غائب'}
            </span></td>
            <td>-</td>
        </tr>
    `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="3">لا يوجد سجل حضور</td></tr>';
}

// تسجيل الخروج
function logout() {
    localStorage.removeItem('student');
    window.location.reload();
}

// مساعدة في معالجة JSON
function parseJSON(str) {
    try {
        return JSON.parse(str || '{}');
    } catch {
        return {};
    }
}

// تنسيق التاريخ
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-SA');
}

// الحصول على التقدير
function getGradeText(score) {
    if (score >= 90) return 'ممتاز';
    if (score >= 80) return 'جيد جداً';
    if (score >= 70) return 'جيد';
    if (score >= 60) return 'مقبول';
    return 'راسب';
}

// الحصول على فئة التقدير
function getGradeClass(score) {
    if (score >= 90) return 'excellent';
    if (score >= 80) return 'good';
    if (score >= 70) return 'pass';
    return 'fail';
}