// assets/js/school.js
let currentSchool = null;
let students = [];
let subjects = [];
let currentStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndLoadSchool();
    setupEventListeners();
    loadData();
});

// Check authentication and load school data
function checkAuthAndLoadSchool() {
    const token = localStorage.getItem('token');
    const school = localStorage.getItem('school');
    
    if (!token || !school) {
        // Temporary fallback for testing - should redirect to login in production
        currentSchool = { id: 3, name: 'مدرسة تجريبية', code: 'SCH-573214-GSW' };
        showDashboard();
        return;
    }
    
    try {
        currentSchool = JSON.parse(school);
        showDashboard();
    } catch (error) {
        console.error('Error parsing school data:', error);
        // Fallback for testing
        currentSchool = { id: 3, name: 'مدرسة تجريبية', code: 'SCH-573214-GSW' };
        showDashboard();
    }
}

function setupEventListeners() {
    document.getElementById('subjectForm')?.addEventListener('submit', addSubject);
    document.getElementById('addStudentForm')?.addEventListener('submit', addStudent);
}

function showDashboard() {
    const schoolNameElement = document.getElementById('schoolName');
    console.log('showDashboard called');
    console.log('schoolName element:', schoolNameElement);
    console.log('currentSchool:', currentSchool);
    
    if (schoolNameElement && currentSchool) {
        schoolNameElement.textContent = currentSchool.name;
    }
}

// Add manual refresh function for debugging
function refreshStudentsList() {
    console.log('Manual refresh triggered');
    fetchStudents();
}

// Add this to window for debugging
window.refreshStudentsList = refreshStudentsList;
window.debugInfo = function() {
    console.log('Current school:', currentSchool);
    console.log('Students array:', students);
    console.log('Table body element:', document.getElementById('studentsTableBody'));
};

function loadData() {
    // Load subjects
    const savedSubjects = localStorage.getItem('subjects');
    if (savedSubjects) {
        subjects = JSON.parse(savedSubjects);
    } else {
        // Default subjects
        subjects = ['اللغة العربية', 'الرياضيات', 'العلوم', 'الانجليزية'];
        localStorage.setItem('subjects', JSON.stringify(subjects));
    }
    
    // Load students from server
    fetchStudents();
    
    renderSubjects();
}

// Fetch students from server
async function fetchStudents() {
    if (!currentSchool || !currentSchool.id) {
        console.log('No school or school ID:', currentSchool);
        return;
    }
    
    console.log('Fetching students for school ID:', currentSchool.id);
    
    try {
        const response = await fetch(`/api/school/${currentSchool.id}/students`);
        console.log('API Response status:', response.status);
        
        if (response.ok) {
            students = await response.json();
            console.log('Raw students from API:', students);
            
            // Parse detailed_scores and daily_attendance JSON strings
            students.forEach(student => {
                if (typeof student.detailed_scores === 'string') {
                    try {
                        student.grades = JSON.parse(student.detailed_scores);
                    } catch {
                        student.grades = {};
                    }
                }
                if (typeof student.daily_attendance === 'string') {
                    try {
                        student.attendance = JSON.parse(student.daily_attendance);
                    } catch {
                        student.attendance = {};
                    }
                }
            });
            
            console.log('Processed students:', students);
        } else {
            const errorText = await response.text();
            console.error('API Error:', errorText);
            students = [];
        }
    } catch (error) {
        console.error('Error fetching students:', error);
        students = [];
    }
    
    renderStudentsTable();
}

// إدارة المواد
function addSubject(e) {
    e.preventDefault();
    
    const subjectName = document.getElementById('subjectNameInput').value.trim();
    
    if (!subjectName) {
        showNotification('يرجى إدخال اسم المادة', 'error');
        return;
    }
    
    if (subjects.includes(subjectName)) {
        showNotification('هذه المادة موجودة بالفعل', 'error');
        return;
    }
    
    subjects.push(subjectName);
    localStorage.setItem('subjects', JSON.stringify(subjects));
    
    document.getElementById('subjectNameInput').value = '';
    renderSubjects();
    showNotification('تم إضافة المادة بنجاح', 'success');
}

function renderSubjects() {
    const container = document.getElementById('subjectsList');
    if (!container) return;
    
    container.innerHTML = subjects.map((subject, index) => `
        <div class="subject-card">
            <span class="subject-name">${subject}</span>
            <div class="subject-actions">
                <button class="btn-small btn-info" onclick="editSubject(${index})">
                    <i class="fas fa-edit"></i> تعديل
                </button>
                <button class="btn-small btn-danger" onclick="deleteSubject(${index})">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </div>
        </div>
    `).join('');
}

function editSubject(index) {
    const newName = prompt('أدخل الاسم الجديد للمادة:', subjects[index]);
    
    if (newName && newName.trim() && newName.trim() !== subjects[index]) {
        const trimmedName = newName.trim();
        
        if (subjects.includes(trimmedName)) {
            showNotification('هذا الاسم موجود بالفعل', 'error');
            return;
        }
        
        subjects[index] = trimmedName;
        localStorage.setItem('subjects', JSON.stringify(subjects));
        renderSubjects();
        showNotification('تم تعديل المادة بنجاح', 'success');
    }
}

function deleteSubject(index) {
    if (confirm(`هل أنت متأكد من حذف مادة "${subjects[index]}"؟`)) {
        subjects.splice(index, 1);
        localStorage.setItem('subjects', JSON.stringify(subjects));
        renderSubjects();
        showNotification('تم حذف المادة بنجاح', 'success');
    }
}

function generateStudentCode() {
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
    const random = Math.random().toString(36).substr(2, 3).toUpperCase(); // 3 random characters
    return `STD-${timestamp}-${random}`;
}

function generateUniqueStudentCode() {
    let code;
    do {
        code = generateStudentCode();
    } while (students.some(student => student.student_code === code));
    return code;
}

async function addStudent(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const editingId = e.target.dataset.editingId;
    
    const studentData = {
        full_name: formData.get('full_name'),
        grade: `${formData.get('level')} - ${formData.get('grade')}`,
        branch: formData.get('branch') || '',
        room: formData.get('room')
    };
    
    try {
        if (editingId) {
            // Update existing student
            const response = await fetch(`/api/student/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
            
            if (response.ok) {
                showNotification('تم تحديث بيانات الطالب بنجاح!', 'success');
                
                // Reset form mode
                delete e.target.dataset.editingId;
                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.innerHTML = '<i class="fas fa-save"></i> حفظ بيانات الطالب';
            } else {
                const error = await response.json();
                showNotification(error.error || 'حدث خطأ في تحديث الطالب', 'error');
                return;
            }
        } else {
            // Add new student
            const response = await fetch(`/api/school/${currentSchool.id}/student`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
            
            if (response.ok) {
                const result = await response.json();
                showNotification(`تم حفظ بيانات الطالب بنجاح! رمز الطالب: ${result.student_code}`, 'success');
            } else {
                const error = await response.json();
                showNotification(error.error || 'حدث خطأ في إضافة الطالب', 'error');
                return;
            }
        }
        
        // Reload students from server
        await fetchStudents();
        
        // Reset form
        e.target.reset();
        
    } catch (error) {
        console.error('Error saving student:', error);
        showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    
    if (!tbody) {
        console.error('studentsTableBody element not found!');
        return;
    }

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem;">لا يوجد طلاب مسجلين حالياً</td></tr>';
        return;
    }

    tbody.innerHTML = students.map(student => {
        // Parse grade to extract level and grade parts
        const gradeParts = student.grade ? student.grade.split(' - ') : ['', ''];
        const level = gradeParts[0] || '';
        const grade = gradeParts[1] || '';
        
        return `
        <tr data-id="${student.id}">
            <td><strong>${student.full_name}</strong></td>
            <td><span class="badge">${level}</span></td>
            <td>${grade}</td>
            <td>${student.branch || '-'}</td>
            <td>${student.room}</td>
            <td><code class="code-btn" onclick="copyToClipboard('${student.student_code}')">${student.student_code}</code></td>
            <td>
                <button class="btn-small btn-info" onclick="openGradesModal(${student.id})"><i class="fas fa-chart-line"></i> الدرجات</button>
                <button class="btn-small btn-success" onclick="openAttendanceModal(${student.id})"><i class="fas fa-calendar-check"></i> الحضور</button>
                <button class="btn-small btn-info" onclick="editStudent(${student.id})"><i class="fas fa-edit"></i> تعديل</button>
                <button class="btn-small btn-danger" onclick="deleteStudent(${student.id})"><i class="fas fa-trash"></i> حذف</button>
            </td>
        </tr>
        `;
    }).join('');
}

// إدارة الدرجات
function openGradesModal(studentId) {
    currentStudentId = studentId;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    document.getElementById('gradesStudentName').textContent = student.full_name;
    
    // Ensure student has grades for all current subjects
    subjects.forEach(subject => {
        if (!student.grades[subject]) {
            student.grades[subject] = {
                month1: 0,
                month2: 0,
                midterm: 0,
                month3: 0,
                month4: 0,
                final: 0
            };
        }
    });
    
    renderGradesTable();
    document.getElementById('gradesModal').style.display = 'flex';
}

function renderGradesTable() {
    const tbody = document.getElementById('gradesTableBody');
    if (!tbody) return;
    
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;
    
    // Initialize totals for each period
    const totals = {
        month1: 0,
        month2: 0,
        midterm: 0,
        month3: 0,
        month4: 0,
        final: 0
    };
    
    let subjectCount = subjects.length;
    
    tbody.innerHTML = subjects.map(subject => {
        const grades = student.grades[subject] || {
            month1: 0, month2: 0, midterm: 0, month3: 0, month4: 0, final: 0
        };
        
        // Add to totals (only count non-zero grades for totals)
        Object.keys(totals).forEach(period => {
            const gradeValue = parseInt(grades[period]) || 0;
            totals[period] += gradeValue;
        });
        
        // Determine the latest grade and result
        const latestGrade = getLatestGrade(grades);
        const result = getGradeResult(latestGrade);
        
        return `
            <tr>
                <td><strong>${subject}</strong></td>
                <td><input type="number" class="grade-input" value="${grades.month1}" 
                          onchange="updateGrade('${subject}', 'month1', this.value)" min="0" max="100"></td>
                <td><input type="number" class="grade-input" value="${grades.month2}" 
                          onchange="updateGrade('${subject}', 'month2', this.value)" min="0" max="100"></td>
                <td><input type="number" class="grade-input" value="${grades.midterm}" 
                          onchange="updateGrade('${subject}', 'midterm', this.value)" min="0" max="100"></td>
                <td><input type="number" class="grade-input" value="${grades.month3}" 
                          onchange="updateGrade('${subject}', 'month3', this.value)" min="0" max="100"></td>
                <td><input type="number" class="grade-input" value="${grades.month4}" 
                          onchange="updateGrade('${subject}', 'month4', this.value)" min="0" max="100"></td>
                <td><input type="number" class="grade-input" value="${grades.final}" 
                          onchange="updateGrade('${subject}', 'final', this.value)" min="0" max="100"></td>
                <td><span class="result-${result.status}">${result.text}</span></td>
            </tr>
        `;
    }).join('');
    
    // Update totals and averages
    updateTotalsAndAverages(totals, subjectCount);
}

function getLatestGrade(grades) {
    // Check grades from final to month1 to find the latest non-zero grade
    const periods = ['final', 'month4', 'month3', 'midterm', 'month2', 'month1'];
    
    for (let period of periods) {
        const grade = parseInt(grades[period]) || 0;
        if (grade > 0) {
            return { grade, period };
        }
    }
    
    return { grade: 0, period: 'none' };
}

function getGradeResult(latestGrade) {
    if (latestGrade.grade === 0) {
        return { status: 'pending', text: 'معلق' }; // Pending
    }
    
    // Pass threshold is 50
    if (latestGrade.grade >= 50) {
        return { status: 'pass', text: 'ناجح' }; // Pass
    } else {
        return { status: 'fail', text: 'راسب' }; // Fail
    }
}

function updateTotalsAndAverages(totals, subjectCount) {
    // Update totals
    document.getElementById('month1Total').textContent = totals.month1;
    document.getElementById('month2Total').textContent = totals.month2;
    document.getElementById('midtermTotal').textContent = totals.midterm;
    document.getElementById('month3Total').textContent = totals.month3;
    document.getElementById('month4Total').textContent = totals.month4;
    document.getElementById('finalTotal').textContent = totals.final;
    
    // Calculate and update averages
    if (subjectCount > 0) {
        const month1Avg = (totals.month1 / subjectCount).toFixed(1);
        const month2Avg = (totals.month2 / subjectCount).toFixed(1);
        const midtermAvg = (totals.midterm / subjectCount).toFixed(1);
        const month3Avg = (totals.month3 / subjectCount).toFixed(1);
        const month4Avg = (totals.month4 / subjectCount).toFixed(1);
        const finalAvg = (totals.final / subjectCount).toFixed(1);
        
        document.getElementById('month1Average').textContent = month1Avg;
        document.getElementById('month2Average').textContent = month2Avg;
        document.getElementById('midtermAverage').textContent = midtermAvg;
        document.getElementById('month3Average').textContent = month3Avg;
        document.getElementById('month4Average').textContent = month4Avg;
        document.getElementById('finalAverage').textContent = finalAvg;
        
        // Calculate overall average (sum of all periods divided by total possible)
        const totalSum = Object.values(totals).reduce((sum, val) => sum + val, 0);
        const overallAvg = (totalSum / (subjectCount * 6)).toFixed(1);
        document.getElementById('overallAverage').textContent = overallAvg;
    }
}

async function updateGrade(subject, period, value) {
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;
    
    if (!student.grades) {
        student.grades = {};
    }
    
    if (!student.grades[subject]) {
        student.grades[subject] = {};
    }
    
    student.grades[subject][period] = parseInt(value) || 0;
    
    // Save to server
    try {
        const response = await fetch(`/api/student/${currentStudentId}/detailed`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailed_scores: student.grades,
                daily_attendance: student.attendance || {}
            })
        });
        
        if (response.ok) {
            // Show brief success feedback
            console.log('Grade saved successfully for', subject, period, value);
        } else {
            const errorData = await response.json();
            console.error('Server error saving grades:', errorData);
            showNotification('حدث خطأ في حفظ الدرجات', 'error');
        }
    } catch (error) {
        console.error('Error saving grades:', error);
        showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    }
    
    // Re-render the table to update totals and averages
    renderGradesTable();
}

function saveGrades() {
    showNotification('تم حفظ الدرجات بنجاح', 'success');
    closeModal('gradesModal');
}

// إدارة الحضور
function openAttendanceModal(studentId) {
    currentStudentId = studentId;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    
    document.getElementById('attendanceStudentName').textContent = student.full_name;
    document.getElementById('attendanceDate').value = new Date().toISOString().split('T')[0];
    
    renderAttendanceTable();
    document.getElementById('attendanceModal').style.display = 'flex';
}

async function addDailyAttendance() {
    const date = document.getElementById('attendanceDate').value;
    if (!date) {
        showNotification('يرجى اختيار التاريخ', 'error');
        return;
    }
    
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;
    
    if (!student.attendance) {
        student.attendance = {};
    }
    
    if (student.attendance[date]) {
        showNotification('حضور هذا اليوم موجود بالفعل', 'error');
        return;
    }
    
    // Initialize attendance for all subjects
    student.attendance[date] = {};
    subjects.forEach(subject => {
        student.attendance[date][subject] = 'حاضر'; // Default to present
    });
    
    // Save to server
    try {
        const response = await fetch(`/api/student/${currentStudentId}/detailed`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailed_scores: student.grades || {},
                daily_attendance: student.attendance
            })
        });
        
        if (response.ok) {
            renderAttendanceTable();
            showNotification('تم إضافة يوم جديد', 'success');
        } else {
            showNotification('حدث خطأ في حفظ بيانات الحضور', 'error');
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

function renderAttendanceTable() {
    const container = document.getElementById('attendanceTableContainer');
    if (!container) return;
    
    const student = students.find(s => s.id === currentStudentId);
    if (!student || !student.attendance) {
        container.innerHTML = '<p>لا يوجد بيانات حضور</p>';
        return;
    }
    
    const dates = Object.keys(student.attendance).sort().reverse();
    
    container.innerHTML = dates.map(date => {
        const attendance = student.attendance[date];
        
        return `
            <div class="attendance-day">
                <div class="day-header">
                    <span>تاريخ: ${date}</span>
                    <button class="btn-small btn-danger" onclick="removeDayAttendance('${date}')">
                        <i class="fas fa-trash"></i> حذف اليوم
                    </button>
                </div>
                <div class="subjects-attendance">
                    ${subjects.map(subject => `
                        <div class="subject-attendance">
                            <span>${subject}</span>
                            <div class="attendance-status">
                                <button class="status-btn status-present ${attendance[subject] === 'حاضر' ? 'active' : ''}" 
                                        onclick="setAttendanceStatus('${date}', '${subject}', 'حاضر')">حاضر</button>
                                <button class="status-btn status-absent ${attendance[subject] === 'غائب' ? 'active' : ''}" 
                                        onclick="setAttendanceStatus('${date}', '${subject}', 'غائب')">غائب</button>
                                <button class="status-btn status-leave ${attendance[subject] === 'إجازة' ? 'active' : ''}" 
                                        onclick="setAttendanceStatus('${date}', '${subject}', 'إجازة')">إجازة</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

async function setAttendanceStatus(date, subject, status) {
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;
    
    if (!student.attendance) {
        student.attendance = {};
    }
    
    if (!student.attendance[date]) {
        student.attendance[date] = {};
    }
    
    student.attendance[date][subject] = status;
    
    // Save to server
    try {
        const response = await fetch(`/api/student/${currentStudentId}/detailed`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                detailed_scores: student.grades || {},
                daily_attendance: student.attendance
            })
        });
        
        if (!response.ok) {
            showNotification('حدث خطأ في حفظ بيانات الحضور', 'error');
        }
    } catch (error) {
        console.error('Error saving attendance:', error);
        showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    }
    
    renderAttendanceTable();
}

function removeDayAttendance(date) {
    if (!confirm(`هل أنت متأكد من حذف حضور يوم ${date}؟`)) {
        return;
    }
    
    const student = students.find(s => s.id === currentStudentId);
    if (!student) return;
    
    delete student.attendance[date];
    renderAttendanceTable();
    showNotification('تم حذف حضور اليوم', 'success');
}

function saveAttendance() {
    showNotification('تم حفظ بيانات الحضور بنجاح', 'success');
    closeModal('attendanceModal');
}

// دوال مساعدة
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(`تم نسخ الرمز: ${text}`, 'info');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification(`تم نسخ الرمز: ${text}`, 'info');
    });
}

function editStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;
    
    // Parse grade to extract level and grade
    const gradeParts = student.grade ? student.grade.split(' - ') : ['', ''];
    const level = gradeParts[0] || '';
    const grade = gradeParts[1] || '';
    
    // Fill the form with student data for editing
    const form = document.getElementById('addStudentForm');
    form.full_name.value = student.full_name;
    form.level.value = level;
    form.grade.value = grade;
    form.branch.value = student.branch || '';
    form.room.value = student.room;
    if (form.notes) {
        form.notes.value = student.notes || '';
    }
    
    // Change button text and add update functionality
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.innerHTML = '<i class="fas fa-save"></i> تحديث بيانات الطالب';
    
    // Store the student ID for updating
    form.dataset.editingId = id;
    
    // Scroll to form
    form.scrollIntoView({ behavior: 'smooth' });
}

async function deleteStudent(id) {
    if (!confirm('هل أنت متأكد من حذف بيانات هذا الطالب؟')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/student/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // Reload students from server
            await fetchStudents();
            showNotification('تم حذف بيانات الطالب بنجاح', 'success');
        } else {
            const error = await response.json();
            showNotification(error.error || 'حدث خطأ في حذف الطالب', 'error');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        showNotification('حدث خطأ في الاتصال بالخادم', 'error');
    }
}

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('token');
        localStorage.removeItem('school');
        localStorage.removeItem('subjects'); // Keep subjects as they are school-specific
        window.location.href = '/index.html';
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 9999;
        max-width: 400px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}