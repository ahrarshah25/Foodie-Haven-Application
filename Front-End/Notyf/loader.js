const showLoading = (notyf,message = "Processing...") => {
    const toastId = notyf.open({
    duration: 0,
    dismissible: false,
    type: 'info',
    message: `
      <div class="notyf-center">
        <span class="notyf-loader"></span>
        <span style="color: black">${message}</span>
      </div>
    `,
  });

  return toastId;
}

export default showLoading;