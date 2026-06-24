module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    runtime: 'node-cjs',
    route: '/api/health',
    has_RESEND_API: Boolean(process.env.RESEND_API),
    has_SOL_INTERNAL_TO: Boolean(process.env.SOL_INTERNAL_TO),
    has_RESEND_FROM: Boolean(process.env.RESEND_FROM)
  });
};
