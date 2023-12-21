function appendCustomCode() {
    // Create link element for the stylesheet
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/boxicons/2.1.0/css/boxicons.min.css';
    document.body.appendChild(link);

    // Create style element for the inline styles
    const style = document.createElement('style');
    style.innerHTML = `
    body {
        margin: 0;
        font-family: Arial, sans-serif;
      }
      
      #video-container {
        position: relative;
        max-height: 60vw; /* Adjusted max-height to 60% of viewport width */
        max-width: 80vw; /* Adjusted max-width to 80% of viewport width */
        margin: 0 auto;
        overflow: hidden;
      }
      
      video {
        max-width: 100%; /* Changed width to max-width */
        height: auto;
        display: block;
      }
      
      .custom-controls {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        box-sizing: border-box;
        opacity: 1;
        transition: opacity 0.5s;
      }
      
      .custom-controls button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        font-size: 16px;
      }
      
      .custom-controls button:focus {
        outline: none;
      }
      
      .custom-controls #time-display {
        margin: 0 10px;
        color: white;
      }
      
      .custom-controls #custom-watermark {
        margin-right: 10px;
        color: white;
        text-decoration: none;
        font-size: 14px;
      }
      
      input[type="range"] {
        margin: 0 5px;
      }
      
      #volume {
        width: 80px; /* Adjusted width of the volume slider */
      }
      
      #seek-bar {
        width: 100%; /* Made the video duration seek bar wider */
      }

    `;
    document.body.appendChild(style);

    // Create script element for the JavaScript code
    const script = document.createElement('script');
    script.innerHTML = `
    const video = document.querySelector('video');
    const controls = document.querySelector('.custom-controls');
    const playPauseButton = document.getElementById('play-pause');
    const muteButton = document.getElementById('mute');
    const volumeControl = document.getElementById('volume');
    const seekBar = document.getElementById('seek-bar');
    const timeDisplay = document.getElementById('time-display');
    const customWatermark = document.getElementById('custom-watermark');
    let controlsVisible = true;
  
    playPauseButton.addEventListener('click', togglePlay);
    muteButton.addEventListener('click', toggleMute);
    volumeControl.addEventListener('input', updateVolume);
    video.addEventListener('timeupdate', updateTime);
    video.addEventListener('mousemove', showControls);
    video.addEventListener('touchstart', showControls);
    seekBar.addEventListener('input', updateSeekBar);
  
    function togglePlay() {
      if (video.paused || video.ended) {
        video.play();
        playPauseButton.innerHTML = \`<i class='bx bx-pause' ></i>\`;
      } else {
        video.pause();
        playPauseButton.innerHTML = \`<i class='bx bx-play' ></i>\`;
      }
    }
  
    function toggleMute() {
      if (video.muted) {
        video.muted = false;
        muteButton.innerHTML = \`<i class='bx bx-volume-full' ></i>\`;
      } else {
        video.muted = true;
        muteButton.innerHTML = \`<i class='bx bx-volume-mute' ></i>\`;
      }
    }
  
    function updateVolume() {
      video.volume = volumeControl.value;
    }
  
    function updateTime() {
      const minutes = Math.floor(video.currentTime / 60);
      const seconds = Math.floor(video.currentTime % 60);
      timeDisplay.textContent = \`\${minutes}:\${seconds < 10 ? '0' : ''}\${seconds}\`;

      updateSeekBar();
    }
  
    function updateSeekBar() {
      seekBar.value = (video.currentTime / video.duration) * 100;
    }
  
    function showControls() {
      if (!controlsVisible) {
        controls.style.opacity = '1';
        controlsVisible = true;
        setTimeout(() => {
          hideControls();
        }, 2000);
      }
    }
  
    function hideControls() {
      if (controlsVisible) {
        controls.style.opacity = '0';
        controlsVisible = false;
      }
    }
  `;
    document.body.appendChild(script);

    const pegtrol = document.createElement('div');
    pegtrol.innerHTML = `
      <div class="custom-controls">
        <a id="custom-watermark" style="font-weight: bold;" href="https://pegihost.free.nf" target="_blank">PEGI</a>
        <button id="play-pause"><i class='bx bx-play'></i></button>
        <input type="range" id="seek-bar" min="0" value="0">
        <span id="time-display">0:00</span>
        <button id="mute"><i class='bx bx-volume-full'></i></button>
        <input type="range" id="volume" min="0" max="1" step="0.1" value="1">
      </div>
    `;
    
    // Assuming 'video-container' is the correct ID, replace it with the actual ID if needed
    document.getElementById('video-container').appendChild(pegtrol);


  }

  // Call the function when the page has loaded
  appendCustomCode();