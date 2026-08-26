// Camera page — asks for permission, shows a live preview, and can capture
// a still frame. Everything stays in the browser: nothing is uploaded.
(() => {
  const video = document.getElementById('cam-video');
  const overlay = document.getElementById('cam-overlay');
  const overlayTitle = document.getElementById('cam-title');
  const overlayMsg = document.getElementById('cam-msg');
  const enableBtn = document.getElementById('cam-enable');
  const captureBtn = document.getElementById('cam-capture');
  const stopBtn = document.getElementById('cam-stop');
  const downloadLink = document.getElementById('cam-download');
  const statusEl = document.getElementById('cam-status');
  const canvas = document.getElementById('cam-canvas');
  const snapshotWrap = document.getElementById('cam-snapshot-wrap');
  const snapshotImg = document.getElementById('cam-snapshot');

  let stream = null;

  function setStatus(text) { statusEl.textContent = text; }

  function showOverlay(title, msg, showEnable) {
    overlayTitle.textContent = title;
    overlayMsg.textContent = msg;
    enableBtn.style.display = showEnable ? 'inline-block' : 'none';
    overlay.classList.add('show');
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showOverlay(
      'NOT AVAILABLE',
      'This browser or connection doesn\u2019t support camera access here — it needs HTTPS (or localhost).',
      false
    );
    setStatus('Unavailable');
    enableBtn.disabled = true;
  }

  async function enableCamera() {
    enableBtn.disabled = true;
    setStatus('Requesting…');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
      overlay.classList.remove('show');
      captureBtn.disabled = false;
      stopBtn.disabled = false;
      setStatus('Live');
    } catch (err) {
      let msg = 'Something went wrong starting the camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied. Allow it in your browser\u2019s site settings, then try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera was found on this device.';
      } else if (err.name === 'NotReadableError') {
        msg = 'The camera is already in use by another app.';
      }
      showOverlay('CAMERA BLOCKED', msg, true);
      setStatus('Blocked');
      enableBtn.disabled = false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    video.srcObject = null;
    captureBtn.disabled = true;
    stopBtn.disabled = true;
    enableBtn.disabled = false;
    setStatus('Idle');
    showOverlay('CAMERA OFF', 'Grant camera access to begin live capture. Nothing leaves your browser.', true);
  }

  function captureFrame() {
    if (!stream) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    // Mirror the drawn frame so the saved image matches the mirrored preview.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/png');
    snapshotImg.src = dataUrl;
    snapshotWrap.hidden = false;
    downloadLink.href = dataUrl;
    downloadLink.hidden = false;
  }

  enableBtn.addEventListener('click', enableCamera);
  stopBtn.addEventListener('click', stopCamera);
  captureBtn.addEventListener('click', captureFrame);

  // Release the camera the moment the tab is hidden or the page is left.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopCamera();
  });
  window.addEventListener('pagehide', stopCamera);
})();
