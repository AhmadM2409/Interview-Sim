export const successEnvelope = (data) => ({
  success: true,
  data,
  error: null,
});

export const errorEnvelope = (error) => ({
  success: false,
  data: null,
  error,
});
