import { createSlice } from "@reduxjs/toolkit";

const getStoredAuth = () => {
  if (typeof sessionStorage === "undefined") {
    return null;
  }

  try {
    const storedAuth = sessionStorage.getItem("hiremind-auth");
    return storedAuth ? JSON.parse(storedAuth) : null;
  } catch {
    return null;
  }
};

const storedAuth = getStoredAuth();

const initialState = {
  user: storedAuth?.user || null,
  token: storedAuth?.token || null,
  loading: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("hiremind-auth", JSON.stringify({
          user: state.user,
          token: state.token,
        }));
      }
    },

    updateUser: (state, action) => {
      state.user = action.payload;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("hiremind-auth", JSON.stringify({
          user: state.user,
          token: state.token,
        }));
      }
    },

    logout: (state) => {
      state.user = null;
      state.token = null;
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("hiremind-auth");
      }
    },
  },
});

export const { loginSuccess, updateUser, logout } = authSlice.actions;

export default authSlice.reducer;
