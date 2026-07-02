const storage = {
  list: async (prefix) => {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
    return { keys };
  },
  get: async (key) => {
    const value = localStorage.getItem(key);
    return value !== null ? { value } : null;
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return true;
  },
  delete: async (key) => {
    localStorage.removeItem(key);
  },
};

export default storage;
