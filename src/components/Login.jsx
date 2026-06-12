import React from "react";
import Header from "./Header";
import LoginForm from "./LoginForm";

function Login() {
  return (
    <div
      className="min-h-screen flex flex-col bg-[#FFFFFF] overflow-x-hidden"
      style={{ fontFamily: 'Lexend, "Noto Sans", sans-serif' }}
    >
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}

export default Login;
