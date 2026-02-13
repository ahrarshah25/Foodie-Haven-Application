const CLOUD_NAME = "dnkuvmxuv";
const UPLOAD_PRESET = "foodApp";

const imageUploadHandler = async (file) => {
  if (!file) {
    throw new Error("No file provided");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Upload failed");
    }

    const data = await response.json();
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      type: 'image'
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default imageUploadHandler;