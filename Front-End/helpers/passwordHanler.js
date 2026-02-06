const passwordHandler = (password) => {
  if (!password || typeof password !== "string") {
    return { isValid: false, strength: "weak", requirements: {} };
  }

  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const metCount = Object.values(requirements).filter(Boolean).length;

  let strength;
  if (metCount === 5) {
    strength = "strong";
  } else if (metCount >= 3) {
    strength = "medium";
  } else {
    strength = "weak";
  }

  const isValid = Object.values(requirements).every((req) => req === true);

  return {
    isValid,
    strength,
    requirements,
    metCount,
    totalCount: 5,
  };
};

export default passwordHandler;
