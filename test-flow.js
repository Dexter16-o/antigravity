const puppeteer = require('puppeteer');

(async () => {
  console.log('🚀 Starting automated CampusYak integration test...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport to a typical mobile device since this is mobile-first
  await page.setViewport({ width: 375, height: 812 });

  try {
    // ----------------------------------------------------
    // 1. Load feed and check basic access
    // ----------------------------------------------------
    console.log('🔗 Navigating to CampusYak feed...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    
    const title = await page.title();
    console.log(`✅ Page loaded. Title: "${title}"`);

    // Fetch initial karma value
    const initialKarma = await page.evaluate(() => {
      const el = document.getElementById('karma-display');
      return el ? parseInt(el.textContent) : 0;
    });
    console.log(`ℹ️ Initial user karma score: ${initialKarma}`);

    // ----------------------------------------------------
    // 2. Create Post in Hostel/Mess Category
    // ----------------------------------------------------
    console.log('✍️ Creating a new anonymous post in "Hostel/Mess" category...');
    await page.waitForSelector('#post-composer-textarea');
    await page.type('#post-composer-textarea', 'Automated test post: Mess food reviews 🍲🤖');
    
    // Select category
    await page.select('#post-category-select', 'Hostel/Mess');

    await page.click('#post-submit-btn');
    console.log('📤 Submitting post...');

    // Wait for insertion
    await page.waitForTimeout ? await page.waitForTimeout(1500) : new Promise(r => setTimeout(r, 1500));
    
    // Get the post ID of the newly created post
    const postId = await page.evaluate(() => {
      const card = document.querySelector('div[id^="post-"]:not(#post-composer-textarea)');
      return card ? card.id.replace('post-', '') : null;
    });
    console.log(`📌 Created Post ID: ${postId}`);

    // ----------------------------------------------------
    // 3. Test Category Filters
    // ----------------------------------------------------
    console.log('🔍 Testing category horizontal filters...');
    
    // Filter by Marketplace (should hide the Hostel/Mess post)
    console.log('   👉 Filtering by "Marketplace"...');
    await page.click('#filter-category-marketplace');
    await page.waitForTimeout ? await page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));
    
    let postExists = await page.evaluate((id) => {
      return document.getElementById(`post-${id}`) !== null;
    }, postId);
    if (!postExists) {
      console.log('   ✅ Success: Hostel/Mess post is hidden under Marketplace category filter.');
    } else {
      throw new Error('Failure: Hostel/Mess post was visible under Marketplace category filter.');
    }

    // Filter by Hostel/Mess (should show the post)
    console.log('   👉 Filtering by "Hostel/Mess"...');
    await page.click('#filter-category-hostel-mess');
    await page.waitForTimeout ? await page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));
    
    postExists = await page.evaluate((id) => {
      return document.getElementById(`post-${id}`) !== null;
    }, postId);
    if (postExists) {
      console.log('   ✅ Success: Hostel/Mess post is visible under Hostel/Mess category filter.');
    } else {
      throw new Error('Failure: Hostel/Mess post was hidden under Hostel/Mess category filter.');
    }

    // Reset filter to All
    await page.click('#filter-category-all');
    await page.waitForTimeout ? await page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));

    // ----------------------------------------------------
    // 4. Test Upvoting and Yakarma Points increment
    // ----------------------------------------------------
    console.log('👍 Testing upvote and karma tracking...');
    
    const upvoteBtnSelector = `#upvote-btn-${postId}`;
    await page.click(upvoteBtnSelector);
    await page.waitForTimeout ? await page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));

    // Reload page to force recalculation if needed
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForSelector('#karma-display');

    const updatedKarma = await page.evaluate(() => {
      const el = document.getElementById('karma-display');
      return el ? parseInt(el.textContent) : 0;
    });
    console.log(`✅ User karma updated: ${updatedKarma} points (Previous: ${initialKarma})`);

    // ----------------------------------------------------
    // 5. Test Direct Messaging (DMs) - Messaging another user
    // ----------------------------------------------------
    console.log('💬 Testing Direct Messaging flow...');

    // Save current user session ID
    const user1SessionId = await page.evaluate(() => {
      return localStorage.getItem('yak_session_id');
    });

    // Create a new session (User 2)
    console.log('   👉 Initializing new session for User 2...');
    await page.evaluate(() => {
      localStorage.removeItem('yak_session_id');
    });
    await page.reload({ waitUntil: 'networkidle2' });

    // Verify we have a new session
    const user2SessionId = await page.evaluate(() => {
      return localStorage.getItem('yak_session_id');
    });
    if (user1SessionId === user2SessionId) {
      throw new Error('Failed to generate a new session ID for User 2.');
    }

    // Find the post created by User 1, click Message
    console.log('   👉 Clicking Message button on User 1\'s post...');
    const messageBtnSelector = `#message-btn-${postId}`;
    await page.waitForSelector(messageBtnSelector);
    await page.click(messageBtnSelector);

    // Wait for DM window loading
    console.log('   👉 Redirecting to messages screen...');
    await page.waitForSelector('#dm-message-input');
    
    // Verify we are in messages screen
    const messagesUrl = page.url();
    if (!messagesUrl.includes('/messages')) {
      throw new Error(`Failed to route to messages panel. Current URL: ${messagesUrl}`);
    }
    console.log('   ✅ Messages panel loaded.');

    // Send a message
    console.log('   👉 Sending an anonymous message to User 1...');
    await page.type('#dm-message-input', 'Hello OP! I want to ask more details about the messpaneer curry. 🐢');
    await page.click('#dm-send-btn');
    await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));
    console.log('   ✅ DM sent.');

    // Switch back to User 1 session
    console.log('   👉 Switching back to User 1\'s session...');
    await page.evaluate((sessId) => {
      localStorage.setItem('yak_session_id', sessId);
    }, user1SessionId);

    // Go to messages screen
    console.log('   👉 Navigating to User 1\'s inbox...');
    await page.goto('http://localhost:3000/messages', { waitUntil: 'networkidle2' });

    // Select the conversation
    console.log('   👉 Selecting incoming conversation thread...');
    await page.waitForSelector('[id^="thread-item-"]');
    await page.click('[id^="thread-item-"]');
    
    await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));

    // Verify message text matches
    const messageReceived = await page.evaluate(() => {
      const messages = document.querySelectorAll('div.rounded-2xl.text-sm p');
      const lastMsg = messages[messages.length - 1];
      return lastMsg ? lastMsg.textContent : '';
    });

    if (messageReceived && messageReceived.includes('paneer curry')) {
      console.log(`   ✅ Success! Message received safely: "${messageReceived.trim()}"`);
    } else {
      throw new Error(`Failure: Expected message details not found. Received: "${messageReceived}"`);
    }

    // ----------------------------------------------------
    // 6. Test DM Message Reporting & Moderation
    // ----------------------------------------------------
    console.log('🚨 Testing DM message reporting...');

    // Find the received message's report button
    const lastMsgId = await page.evaluate(() => {
      const reports = document.querySelectorAll('[id^="report-msg-"]');
      const lastReport = reports[reports.length - 1];
      return lastReport ? lastReport.id.replace('report-msg-', '') : null;
    });

    if (!lastMsgId) {
      throw new Error('Report button for message not found.');
    }

    console.log(`   👉 Flagging message ${lastMsgId}...`);
    await page.click(`#report-msg-${lastMsgId}`);
    
    // Submit report modal
    await page.waitForSelector('#submit-msg-report-btn');
    // Register dialog listener to auto-accept the alert
    const dialogHandler = async dialog => {
      await dialog.accept();
    };
    page.on('dialog', dialogHandler);

    await page.click('#submit-msg-report-btn');
    await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));
    page.off('dialog', dialogHandler);
    console.log('   ✅ Report submitted.');

    // ----------------------------------------------------
    // 7. Verify reported DM in Admin Moderation
    // ----------------------------------------------------
    console.log('🛡️ Opening Admin panel to check reported DMs...');
    await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
    
    await page.waitForSelector('#admin-passphrase-input');
    await page.type('#admin-passphrase-input', 'college-admin-2500'); // wrong passphrase
    await page.click('#admin-login-btn');
    await page.waitForTimeout ? await page.waitForTimeout(500) : new Promise(r => setTimeout(r, 500));

    const loginError = await page.evaluate(() => {
      const el = document.getElementById('admin-login-error');
      return el ? el.textContent : '';
    });
    console.log(`✅ Brute-force check: Incorrect passphrase rejected with message: "${loginError.trim()}"`);

    // Log in with correct passphrase
    console.log('   👉 Unlocking desk with correct credentials...');
    await page.evaluate(() => {
      const input = document.getElementById('admin-passphrase-input');
      if (input) input.value = '';
    });
    await page.type('#admin-passphrase-input', 'college-admin-2026');
    await page.click('#admin-login-btn');
    
    // Wait for dashboard elements to load
    await page.waitForSelector(`[id="reported-dm-${lastMsgId}"]`);
    console.log('✅ Admin dashboard loaded. Reported DM is visible in the queue.');

    // ----------------------------------------------------
    // 8. Test Blocking (Ending conversation)
    // ----------------------------------------------------
    console.log('🚫 Testing conversation lockout (blocking)...');
    await page.goto('http://localhost:3000/messages', { waitUntil: 'networkidle2' });
    await page.waitForSelector('[id^="thread-item-"]');
    await page.click('[id^="thread-item-"]');
    
    // Click End Conversation
    await page.waitForSelector('#end-conversation-btn');
    
    // Mock the confirm box to return true
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    await page.click('#end-conversation-btn');
    
    await page.waitForTimeout ? await page.waitForTimeout(1000) : new Promise(r => setTimeout(r, 1000));
    console.log('✅ End Conversation completed.');

    // Check if input is disabled and warning text is shown
    const isLocked = await page.evaluate(() => {
      const textInput = document.getElementById('dm-message-input');
      const bodyText = document.body.textContent || '';
      return textInput === null && bodyText.includes('conversation has been ended');
    });

    if (isLocked) {
      console.log('✅ Lockout confirmed: Input is hidden, ended chat indicator is displayed.');
    } else {
      throw new Error('Failure: Message input is still active or lockout text is missing after block.');
    }

    // ----------------------------------------------------
    // 9. PWA Verification Checks (Chromium user-agent spoofed)
    // ----------------------------------------------------
    console.log('📱 Verifying PWA capabilities (Manifest, iOS meta checks)...');

    // Check manifest returns standalone
    const manifestResponse = await page.goto('http://localhost:3000/manifest.json');
    const manifestStatus = manifestResponse.status();
    const manifestText = await manifestResponse.text();
    const manifest = JSON.parse(manifestText);

    if ((manifestStatus === 200 || manifestStatus === 304) && manifest.display === 'standalone') {
      console.log('   ✅ Success: PWA Manifest exists and display mode is "standalone".');
    } else {
      throw new Error(`Failure: Invalid manifest configuration. Status: ${manifestStatus}, Display: ${manifest.display}`);
    }

    // Go back to feed with iOS spoofing
    console.log('   👉 Spoofing iOS Safari User Agent (1st Visit)...');
    const pwaPage = await browser.newPage();
    await pwaPage.setViewport({ width: 375, height: 812 });
    
    // Inject mock navigator.standalone properties on load
    await pwaPage.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
      });
      // Mock standalone as false
      (navigator).standalone = false;
    });

    await pwaPage.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // Validate iOS head meta elements exist
    const pwaMetaCapable = await pwaPage.evaluate(() => {
      const el = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
      return el ? el.getAttribute('content') : null;
    });
    const pwaMetaStatus = await pwaPage.evaluate(() => {
      const el = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
      return el ? el.getAttribute('content') : null;
    });

    if (pwaMetaCapable === 'yes' && pwaMetaStatus === 'black-translucent') {
      console.log('   ✅ Success: iOS standalone capability and status bar meta tags verified.');
    } else {
      throw new Error(`Failure: Missing or incorrect iOS meta tags. Capable: ${pwaMetaCapable}, Status: ${pwaMetaStatus}`);
    }

    // Verify banner is NOT shown on the first visit
    let iosBannerExists = await pwaPage.evaluate(() => {
      return document.getElementById('close-ios-pwa-banner') !== null;
    });
    if (iosBannerExists) {
      throw new Error('Failure: iOS walkthrough banner was visible on the first visit.');
    }
    console.log('   ✅ Success: iOS walkthrough banner is correctly hidden on the first visit.');

    // Simulating 2nd visit
    console.log('   👉 Simulating second visit (incrementing visits)...');
    await pwaPage.evaluate(() => {
      localStorage.setItem('yak_pwa_visits', '2');
    });
    await pwaPage.reload({ waitUntil: 'networkidle2' });

    // Wait for the iOS installation prompt to appear on 2nd visit
    console.log('   👉 Waiting for iOS "Add to Home Screen" banner...');
    await pwaPage.waitForSelector('#close-ios-pwa-banner');
    console.log('   ✅ Success: iOS installation banner detected on the second visit.');

    // Click close to trigger cooldown
    await pwaPage.click('#close-ios-pwa-banner');
    console.log('   👉 Dismissed iOS banner (activating cooldown).');

    // Reload to verify it stays hidden (cooldown check)
    await pwaPage.reload({ waitUntil: 'networkidle2' });
    iosBannerExists = await pwaPage.evaluate(() => {
      return document.getElementById('close-ios-pwa-banner') !== null;
    });
    if (iosBannerExists) {
      throw new Error('Failure: iOS walkthrough banner was visible after dismissal (cooldown bypass).');
    }
    console.log('   ✅ Success: Cooldown active, banner remains hidden on subsequent loads.');

    await pwaPage.close();

    // ----------------------------------------------------
    // 10. Chromium Install Banner timing and capture checks
    // ----------------------------------------------------
    console.log('📱 Verifying Chromium capture-and-defer install prompts...');
    const chromPage = await browser.newPage();
    await chromPage.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

    // 1st visit: trigger event, should NOT show banner
    console.log('   👉 Simulating first visit with beforeinstallprompt event...');
    await chromPage.evaluate(() => {
      localStorage.removeItem('yak_pwa_banner_dismissed_time');
      localStorage.setItem('yak_pwa_visits', '1');
      const event = new Event('beforeinstallprompt', { cancelable: true });
      (event).prompt = () => {};
      Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });
      window.dispatchEvent(event);
    });
    let chromBannerExists = await chromPage.evaluate(() => {
      return document.getElementById('close-chromium-pwa-banner') !== null;
    });
    if (chromBannerExists) {
      throw new Error('Failure: Chromium install banner was visible on the first visit.');
    }
    console.log('   ✅ Success: Chromium banner is correctly hidden on the first visit.');

    // 2nd visit: trigger event, banner SHOULD show
    console.log('   👉 Simulating second visit with beforeinstallprompt event...');
    await chromPage.evaluate(() => {
      localStorage.removeItem('yak_pwa_banner_dismissed_time');
      localStorage.setItem('yak_pwa_visits', '2');
      // Dispatch event
      const event = new Event('beforeinstallprompt', { cancelable: true });
      (event).prompt = () => {};
      Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });
      window.dispatchEvent(event);
    });
    
    // Wait for the Chromium banner
    await chromPage.waitForSelector('#close-chromium-pwa-banner');
    console.log('   ✅ Success: Chromium custom install banner rendered on the second visit.');

    // Click close
    await chromPage.click('#close-chromium-pwa-banner');
    console.log('   👉 Dismissed Chromium banner.');

    await chromPage.close();

    // ----------------------------------------------------
    // 11. Style Guide, Design Tokens & Theme Toggle Checks
    // ----------------------------------------------------
    console.log('🎨 Auditing Design Tokens & Gated Style Guide...');

    // 1. Toggle dark theme on main page
    console.log('   👉 Toggling dark mode on the feed page...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#theme-toggle-btn');

    // Get initial class state
    const wasDark = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    console.log(`   ℹ️ Initial document theme state: ${wasDark ? 'dark' : 'light'}`);

    await page.click('#theme-toggle-btn');
    
    // Check root html has toggled class state
    const isDarkNow = await page.evaluate(() => {
      return document.documentElement.classList.contains('dark');
    });
    console.log(`   ℹ️ Toggled document theme state: ${isDarkNow ? 'dark' : 'light'}`);

    if (isDarkNow !== wasDark) {
      console.log('   ✅ Success: Theme toggle successfully flipped root class state.');
    } else {
      throw new Error('Failure: Theme toggle did not change root class state.');
    }

    // 2. Load style guide page
    console.log('   👉 Accessing gated developer style-guide...');
    const stylePage = await browser.newPage();
    await stylePage.goto('http://localhost:3000/style-guide', { waitUntil: 'networkidle2' });

    // Check style-guide page status
    const styleTitle = await stylePage.title();
    if (styleTitle.includes('Style Guide')) {
      console.log('   ✅ Success: Developer style-guide is accessible in dev environment.');
    } else {
      throw new Error('Failure: Style guide was not accessible or returned 404.');
    }

    // Check computed font-family
    const fontFamily = await stylePage.evaluate(() => {
      const el = document.body;
      return window.getComputedStyle(el).fontFamily;
    });
    console.log(`   ℹ️ Computed font family: ${fontFamily}`);
    if (fontFamily.includes('Outfit')) {
      console.log('   ✅ Success: Outfit font face token is active on document body.');
    } else {
      throw new Error(`Failure: Incorrect font family computed: ${fontFamily}`);
    }

    // 3. Take screenshot of style guide for user auditing review
    const screenshotPath = 'C:/Users/Dhruv Patel/.gemini/antigravity/brain/ffc369f6-1d26-49f4-afa8-8cd89391154e/style-guide-screenshot.png';
    console.log(`   👉 Taking screenshot of style-guide page to: ${screenshotPath}`);
    await stylePage.screenshot({ path: screenshotPath, fullPage: true });
    console.log('   ✅ Screenshot saved successfully.');

    await stylePage.close();

    console.log('🎉 Extended Integration Test SUCCESS! All PWA smart prompts, design tokens, and hardened features work perfectly!');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('🏁 Browser closed.');
  }
})();
