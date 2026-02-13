const CLOUD_NAME = "dnkuvmxuv";
const UPLOAD_PRESET = "foodApp";

const videoUploadHandler = async (file) => {
  if (!file) {
    throw new Error("No file provided");
  }

  // Check file size (max 50MB)
  if (file.size > 50 * 1024 * 1024) {
    return {
      success: false,
      error: "Video file size must be less than 50MB"
    };
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("cloud_name", CLOUD_NAME);
  formData.append("resource_type", "video");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Video upload failed");
    }

    const data = await response.json();
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      type: 'video',
      duration: data.duration,
      format: data.format
    };
  } catch (error) {
    console.error("Error uploading video:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default videoUploadHandler;