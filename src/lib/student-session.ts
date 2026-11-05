export interface StudentSession {
  code: string;
  id: string;
  name: string;
  groupName: string;
  welcome: string | null;
  subject: string;
  expires: number;
}

const KEY = "ekhtebarni_student";

export function getStudentSession(): StudentSession | null {
  if (typeof window === "undefined") return null;
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null") as StudentSession | null;
    if (!s || s.expires < Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function setStudentSession(s: Omit<StudentSession, "expires">) {
  sessionStorage.setItem(KEY, JSON.stringify({ ...s, expires: Date.now() + 24 * 3600 * 1000 }));
}

export function clearStudentSession() {
  sessionStorage.removeItem(KEY);
}
