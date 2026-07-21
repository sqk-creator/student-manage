const BASE = '/api';

function getToken(): string {
  return typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
}

function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('token', token);
  }
}

function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('token');
    localStorage.removeItem('teacher');
  }
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

export const api = {
  setToken,
  clearToken,
  getToken,

  login(code: string) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
  },

  getClasses() {
    return request('/classes');
  },

  getAllClasses() {
    return request('/classes');
  },

  createClass(name: string, grade?: string, type?: string, grade_id?: number) {
    return request('/classes', {
      method: 'POST',
      body: JSON.stringify({ name, grade, type, grade_id })
    });
  },

  updateClass(id: number, data: any) {
    return request(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  getClass(id: number) {
    return request(`/classes/${id}`);
  },

  addClassTeacher(classId: number, data: any) {
    return request(`/classes/${classId}/teachers`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  removeClassTeacher(classId: number, teacherId: number) {
    return request(`/classes/${classId}/teachers/${teacherId}`, { method: 'DELETE' });
  },

  updateClassTeacher(classId: number, teacherId: number, data: any) {
    return request(`/classes/${classId}/teachers/${teacherId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteClass(id: number) {
    return request(`/classes/${id}`, { method: 'DELETE' });
  },

  getGrades(params?: { status?: number }) {
    const qs = params?.status !== undefined ? `?status=${params.status}` : '';
    return request(`/grades${qs}`);
  },

  createGrade(data: { grade_name: string; sort?: number }) {
    return request('/grades', { method: 'POST', body: JSON.stringify(data) });
  },

  updateGrade(id: number, data: { grade_name?: string; sort?: number; status?: number }) {
    return request(`/grades/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteGrade(id: number) {
    return request(`/grades/${id}`, { method: 'DELETE' });
  },

  getStudents(classId: number) {
    return request(`/classes/${classId}/students`);
  },

  searchStudents(keyword?: string, classId?: string) {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (classId && classId !== 'all') params.set('class_id', classId);
    return request(`/students?${params.toString()}`);
  },

  createStudent(classId: number, data: any) {
    return request(`/classes/${classId}/students`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getStudent(id: number) {
    return request(`/students/${id}`);
  },

  updateStudent(id: number, data: any) {
    return request(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteStudent(id: number) {
    return request(`/students/${id}`, { method: 'DELETE' });
  },

  getExams(classId: number) {
    return request(`/classes/${classId}/exams`);
  },

  createExam(classId: number, data: any) {
    return request(`/classes/${classId}/exams`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getExamsByQuery(params?: { class_id?: number; group_id?: number }) {
    const qs = new URLSearchParams();
    if (params?.class_id) qs.set('class_id', String(params.class_id));
    if (params?.group_id) qs.set('group_id', String(params.group_id));
    const q = qs.toString();
    return request(`/exams${q ? '?' + q : ''}`);
  },

  createExamByQuery(data: any) {
    return request('/exams', { method: 'POST', body: JSON.stringify(data) });
  },

  updateExam(id: number, data: any) {
    return request(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteExam(id: number) {
    return request(`/exams/${id}`, { method: 'DELETE' });
  },

  getExamGroups(params?: { class_id?: number; grade_id?: number }) {
    const qs = new URLSearchParams();
    if (params?.class_id) qs.set('class_id', String(params.class_id));
    if (params?.grade_id) qs.set('grade_id', String(params.grade_id));
    const q = qs.toString();
    return request(`/exam-groups${q ? '?' + q : ''}`);
  },

  getExamGroup(id: number) {
    return request(`/exam-groups/${id}`);
  },

  createExamGroup(data: any) {
    return request('/exam-groups', { method: 'POST', body: JSON.stringify(data) });
  },

  updateExamGroup(id: number, data: any) {
    return request(`/exam-groups/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  deleteExamGroup(id: number) {
    return request(`/exam-groups/${id}`, { method: 'DELETE' });
  },

  getExamGroupStats(id: number) {
    return request(`/exam-groups/${id}/stats`);
  },

  getScores(params?: { student_id?: number; exam_id?: number; group_id?: number }) {
    const qs = new URLSearchParams();
    if (params?.student_id) qs.set('student_id', String(params.student_id));
    if (params?.exam_id) qs.set('exam_id', String(params.exam_id));
    if (params?.group_id) qs.set('group_id', String(params.group_id));
    const q = qs.toString();
    return request(`/scores${q ? '?' + q : ''}`);
  },

  batchSaveScores(data: { exam_id: number; scores: { student_id: number; score: number }[] }) {
    return request('/scores/batch', { method: 'POST', body: JSON.stringify(data) });
  },

  getExamScores(examId: number) {
    return request(`/exams/${examId}/scores`);
  },

  enterScores(examId: number, scores: any[]) {
    return request(`/exams/${examId}/scores`, {
      method: 'POST',
      body: JSON.stringify({ scores })
    });
  },

  getExamStats(examId: number) {
    return request(`/exams/${examId}/stats`);
  },

  getBanners() {
    return request('/banners');
  },

  createBanner(data: any) {
    return request('/banners', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateBanner(id: number, data: any) {
    return request(`/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteBanner(id: number) {
    return request(`/banners/${id}`, { method: 'DELETE' });
  },

  uploadBanner(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE}/banners/upload`, {
      method: 'POST',
      headers,
      body: formData
    }).then(res => res.json());
  },

  getTeacherProfiles() {
    return request('/teacher-profiles');
  },

  createTeacherProfile(data: any) {
    return request('/teacher-profiles', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTeacherProfile(id: number, data: any) {
    return request(`/teacher-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTeacherProfile(id: number) {
    return request(`/teacher-profiles/${id}`, { method: 'DELETE' });
  },

  uploadStudentPhoto(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE}/students/upload-photo`, {
      method: 'POST',
      headers,
      body: formData
    }).then(res => res.json());
  },

  uploadPhoto(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch(`${BASE}/upload-photo`, {
      method: 'POST',
      headers,
      body: formData
    }).then(res => res.json());
  },

  getTeacherHonors(teacherId: number) {
    return request(`/teacher-profiles/${teacherId}/honors`);
  },

  createTeacherHonor(teacherId: number, data: any) {
    return request(`/teacher-profiles/${teacherId}/honors`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateTeacherHonor(teacherId: number, honorId: number, data: any) {
    return request(`/teacher-profiles/${teacherId}/honors/${honorId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteTeacherHonor(teacherId: number, honorId: number) {
    return request(`/teacher-profiles/${teacherId}/honors/${honorId}`, { method: 'DELETE' });
  },

  clearTeacherHonors(teacherId: number) {
    return request(`/teacher-profiles/${teacherId}/honors`, { method: 'DELETE' });
  },

  getClassEvents(classId: number) {
    return request(`/classes/${classId}/events`);
  },

  createClassEvent(classId: number, data: any) {
    return request(`/classes/${classId}/events`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  updateClassEvent(classId: number, eventId: number, data: any) {
    return request(`/classes/${classId}/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteClassEvent(classId: number, eventId: number) {
    return request(`/classes/${classId}/events/${eventId}`, { method: 'DELETE' });
  },

  getAttendances(params?: { class_id?: number; start_date?: string; end_date?: string }) {
    const qs = new URLSearchParams();
    if (params?.class_id) qs.set('class_id', String(params.class_id));
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const q = qs.toString();
    return request(`/attendances${q ? '?' + q : ''}`);
  },

  getAttendance(id: number) {
    return request(`/attendances/${id}`);
  },

  deleteAttendance(id: number) {
    return request(`/attendances/${id}`, { method: 'DELETE' });
  },

  getStudentComments(studentId: number) {
    return request(`/students/${studentId}/comments`);
  },

  createStudentComment(studentId: number, data: { teacher_name?: string; comment: string; semester?: string }) {
    return request(`/students/${studentId}/comments`, { method: 'POST', body: JSON.stringify(data) });
  },

  deleteStudentComment(studentId: number, id: number) {
    return request(`/students/${studentId}/comments/${id}`, { method: 'DELETE' });
  }
};
