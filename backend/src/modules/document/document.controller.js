const { uploadDocumentForUser } = require("./document.service");

async function uploadDocument(req, res, next) {
  try {
    const result = await uploadDocumentForUser({
      file: req.file,
      userId: req.user.sub,
    });

    return res.status(201).json({
      success: true,
      message: "Document uploaded and processed",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadDocument,
};
