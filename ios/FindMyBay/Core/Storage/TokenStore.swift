// TokenStore.swift
//
// Keychain-backed credential storage. Replaces the Android
// `core/storage/TokenStore.kt` (EncryptedSharedPreferences).
//
// Uses the Security framework directly — no third-party deps needed. Items
// are stored on the iOS Keychain with `kSecAttrAccessibleAfterFirstUnlock`,
// matching the Android default of "available after first device unlock".

import Foundation
import Security

actor TokenStore {

    // Service identifier for keychain queries — keep this stable across versions.
    private let service = "ae.findmybay.tokens"

    private enum Key: String {
        case accessToken
        case refreshToken
        case userId
        case phone
        case fullName
    }

    // MARK: - Public API (parity with TokenStore.kt)

    func save(session: AuthSession) {
        write(session.accessToken,  for: .accessToken)
        write(session.refreshToken, for: .refreshToken)
        write(session.userId,       for: .userId)
        write(session.phone,        for: .phone)
        write(session.fullName,     for: .fullName)
    }

    func clear() {
        for key in [Key.accessToken, .refreshToken, .userId, .phone, .fullName] {
            delete(for: key)
        }
    }

    func accessToken() -> String?  { read(for: .accessToken) }
    func refreshToken() -> String? { read(for: .refreshToken) }
    func userId() -> String?       { read(for: .userId) }
    func phone() -> String?        { read(for: .phone) }
    func fullName() -> String?     { read(for: .fullName) }

    func session() -> AuthSession? {
        guard let access = accessToken(),
              let refresh = refreshToken(),
              let uid = userId(),
              let p = phone() else { return nil }
        return AuthSession(
            accessToken: access,
            refreshToken: refresh,
            userId: uid,
            phone: p,
            fullName: fullName()
        )
    }

    // MARK: - Keychain primitives

    private func write(_ value: String?, for key: Key) {
        guard let value, let data = value.data(using: .utf8) else {
            delete(for: key)
            return
        }
        // Always upsert — delete first then add. Avoids errSecDuplicateItem.
        delete(for: key)
        let attrs: [CFString: Any] = [
            kSecClass:           kSecClassGenericPassword,
            kSecAttrService:     service,
            kSecAttrAccount:     key.rawValue,
            kSecValueData:       data,
            kSecAttrAccessible:  kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(attrs as CFDictionary, nil)
    }

    private func read(for key: Key) -> String? {
        let q: [CFString: Any] = [
            kSecClass:        kSecClassGenericPassword,
            kSecAttrService:  service,
            kSecAttrAccount:  key.rawValue,
            kSecReturnData:   kCFBooleanTrue!,
            kSecMatchLimit:   kSecMatchLimitOne,
        ]
        var item: AnyObject?
        let status = SecItemCopyMatching(q as CFDictionary, &item)
        guard status == errSecSuccess, let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(for key: Key) {
        let q: [CFString: Any] = [
            kSecClass:        kSecClassGenericPassword,
            kSecAttrService:  service,
            kSecAttrAccount:  key.rawValue,
        ]
        SecItemDelete(q as CFDictionary)
    }
}
