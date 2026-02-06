const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const emailHandler = (email) => {
  if (!regex.test(email)) {
    return false;
  }
  return true;
};

export default emailHandler;
