import AsyncStorage from '@react-native-async-storage/async-storage';

const USERS_KEY = 'levelup_users_v1';

const normalizeEmail = (email) => email.trim().toLowerCase();

const loadUsers = async () => {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveUsers = async (users) => {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const userExists = async (email) => {
  const normalized = normalizeEmail(email);
  const users = await loadUsers();
  return users.some((user) => user.email === normalized);
};

export const registerUser = async ({ email, name, password }) => {
  const normalized = normalizeEmail(email);
  const users = await loadUsers();

  if (users.some((user) => user.email === normalized)) {
    throw new Error('User already exists');
  }

  const newUser = {
    email: normalized,
    name: name.trim(),
    password,
    createdAt: new Date().toISOString(),
  };

  await saveUsers([...users, newUser]);
  return newUser;
};

export const verifyUser = async (email, password) => {
  const normalized = normalizeEmail(email);
  const users = await loadUsers();
  const user = users.find((entry) => entry.email === normalized);

  if (!user) {
    throw new Error('User not found');
  }

  if (user.password !== password) {
    throw new Error('Invalid secret code');
  }

  return user;
};
