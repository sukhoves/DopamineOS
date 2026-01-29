//
//  AppDelegate.swift
//  DopamineOS beta build
//
//  Created by Evgenii Sukhov on 11.01.2026.
//

import Cocoa
import SafariServices

// кастомный View для блокировки жестов и клавиатуры
class BlockedContentView: NSView {
    override var acceptsFirstResponder: Bool {
        return true
    }
    
    override func keyDown(with event: NSEvent) {
    }
    
    override func keyUp(with event: NSEvent) {
    }
    
    override func performKeyEquivalent(with event: NSEvent) -> Bool {
        return true
    }
    
    override func touchesBegan(with event: NSEvent) {
    }
    
    override func touchesMoved(with event: NSEvent) {
    }
    
    override func touchesEnded(with event: NSEvent) {
    }
    
    override func touchesCancelled(with event: NSEvent) {
    }
    
    override func beginGesture(with event: NSEvent) {
    }
    
    override func endGesture(with event: NSEvent) {
    }
    
    override func swipe(with event: NSEvent) {
    }
    
    override func rotate(with event: NSEvent) {
    }
    
    override func magnify(with event: NSEvent) {
    }
    
    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        
        if #available(macOS 10.11, *) {
            self.allowedTouchTypes = []
        }
    }
}

// Добавляем кастомный Window для полной блокировки
class BlockingWindow: NSWindow {
    override var canBecomeKey: Bool { return true }
    override var canBecomeMain: Bool { return true }
    
    override func sendEvent(_ event: NSEvent) {
        switch event.type {
        case .swipe, .beginGesture, .endGesture, .rotate, .magnify:
            return
        case .systemDefined:
            if event.subtype.rawValue == 7 || event.subtype.rawValue == 8 {
                return
            }
        default:
            break
        }
        
        super.sendEvent(event)
    }
}

@main
class AppDelegate: NSObject, NSApplicationDelegate {
    
    var blockWindows: [NSWindow] = []
    var checkTimer: Timer?
    var isUnlocked = false
    var unlockTimer: Timer?
    var statusBarItem: NSStatusItem?
    var isExtensionEnabled = false
    
    func applicationDidFinishLaunching(_ aNotification: Notification) {

        NSApp.setActivationPolicy(.accessory)
        
        hideMainWindow()
        
        setupStatusBarItem()
        
        startCheckingExtensionStatus()
    }
    
    func hideMainWindow() {
        for window in NSApplication.shared.windows {
            window.close()
        }
    }
    
    func setupStatusBarItem() {
        let statusBar = NSStatusBar.system
        statusBarItem = statusBar.statusItem(withLength: NSStatusItem.variableLength)
        
        if let button = statusBarItem?.button {
            button.image = NSImage(systemSymbolName: "shield.filled", accessibilityDescription: "")
            button.image?.size = NSSize(width: 18, height: 18)
            
            button.contentTintColor = .white
            
            button.isEnabled = false
            
        }
        
        statusBarItem?.menu = nil
    }
    
    func startCheckingExtensionStatus() {
        checkExtension()
        checkTimer = Timer.scheduledTimer(timeInterval: 2.0, target: self, selector: #selector(checkExtension), userInfo: nil, repeats: true)
    }
    
    @objc func checkExtension() {
        guard !isUnlocked else { return }
        
        let extensionBundleIdentifier = "sukhoves.DopamineOS-beta-build.Extension"
        
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            DispatchQueue.main.async {
                if let state = state, state.isEnabled {
                    self.isExtensionEnabled = true
                    self.hideBlockScreen()
                    self.updateStatusBarIcon(enabled: true)
                } else {
                    self.isExtensionEnabled = false
                    self.showBlockScreenOnAllDesktops()
                    self.updateStatusBarIcon(enabled: false)
                }
            }
        }
    }
    
    func updateStatusBarIcon(enabled: Bool) {
        guard let button = statusBarItem?.button else { return }
        
        if enabled {
            button.image = NSImage(systemSymbolName: "shield.fill", accessibilityDescription: "")
            button.image?.size = NSSize(width: 18, height: 18)
        } else {
            button.image = NSImage(systemSymbolName: "shield.slash.fill", accessibilityDescription: "")
            button.image?.size = NSSize(width: 18, height: 18)
        }
        
        button.contentTintColor = .white
        button.needsDisplay = true
    }
    
    func showBlockScreenOnAllDesktops() {
        NSApp.setActivationPolicy(.prohibited)
        
        if !blockWindows.isEmpty {
            for window in blockWindows {
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(window.contentView)
            }
            return
        }
        
        let screens = NSScreen.screens
        
        for screen in screens {
            let screenFrame = screen.frame
            
            let blockWindow = BlockingWindow(contentRect: screenFrame,
                                            styleMask: [.borderless],
                                            backing: .buffered,
                                            defer: false)
            
            blockWindow.level = .screenSaver
            blockWindow.backgroundColor = .black
            blockWindow.isOpaque = true
            blockWindow.ignoresMouseEvents = false
   
            blockWindow.collectionBehavior = [
                .canJoinAllSpaces,
                .stationary,
                .fullScreenAuxiliary,
                .fullScreenPrimary,
                .ignoresCycle
            ]
            
            let unlockButton = NSButton(title: "Разблокировать на 10 секунд", target: self, action: #selector(unlockTapped))
            unlockButton.frame = NSRect(x: 0, y: 0, width: 250, height: 40)
            unlockButton.bezelStyle = .rounded
            unlockButton.font = NSFont.boldSystemFont(ofSize: 16)
            
            let messageLabel = NSTextField(labelWithString: "⚠️ Расширение Safari выключено")
            messageLabel.font = NSFont.boldSystemFont(ofSize: 24)
            messageLabel.textColor = .white
            messageLabel.alignment = .center
            messageLabel.frame = NSRect(x: 0, y: 100, width: screenFrame.width, height: 40)
            messageLabel.isBezeled = false
            messageLabel.isEditable = false
            messageLabel.backgroundColor = .clear
            
            let contentView = BlockedContentView(frame: screenFrame)
            unlockButton.setFrameOrigin(NSPoint(x: (contentView.bounds.width)/2 - 125,
                                               y: (contentView.bounds.height)/2 - 20))
            messageLabel.setFrameOrigin(NSPoint(x: 0,
                                               y: (contentView.bounds.height)/2 + 40))
            
            contentView.addSubview(unlockButton)
            contentView.addSubview(messageLabel)
            
            blockWindow.contentView = contentView
            blockWindow.makeKeyAndOrderFront(nil)
            blockWindow.orderFrontRegardless()
            
            blockWindow.makeFirstResponder(contentView)
            
            blockWindows.append(blockWindow)
        }
        
        NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            if event.modifierFlags.contains(.command) {
                switch event.keyCode {
                case 12, 13, 0, 1, 7:
                    return nil
                default:
                    break
                }
            }
            
            if event.modifierFlags.contains(.function) {
                return nil
            }
            
            return event
        }
        
        NSEvent.addGlobalMonitorForEvents(matching: [
            .swipe, .beginGesture, .endGesture, .rotate, .magnify
        ]) { event in
            
        }
        
        NSApp.activate(ignoringOtherApps: true)
    }
    
    func hideBlockScreen() {
        for window in blockWindows {
            window.orderOut(nil)
        }
        
        if !isUnlocked {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                if self.isExtensionEnabled {
                    NSApp.setActivationPolicy(.accessory)
                }
            }
        } else {
            NSApp.setActivationPolicy(.accessory) 
        }
    }
    
    @objc func unlockTapped() {
        isUnlocked = true
        hideBlockScreen()
        
        updateStatusBarIcon(enabled: false)
        
        unlockTimer?.invalidate()
        unlockTimer = Timer.scheduledTimer(timeInterval: 10.0, target: self, selector: #selector(lockAgain), userInfo: nil, repeats: false)
    }
    
    @objc func lockAgain() {
        isUnlocked = false
        checkExtension()
    }
    
    func applicationWillTerminate(_ aNotification: Notification) {
        checkTimer?.invalidate()
        unlockTimer?.invalidate()
    }
    
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
}

