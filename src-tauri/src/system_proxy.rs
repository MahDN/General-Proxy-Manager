#[cfg(windows)]
pub fn set_system_proxy_win(enable: bool, host: &str, port: u16) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let internet_settings = hkcu
        .open_subkey_with_flags(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            KEY_SET_VALUE,
        )
        .map_err(|e| format!("Failed to open registry: {}", e))?;

    if enable {
        let proxy_server = format!("{}:{}", host, port);
        internet_settings
            .set_value("ProxyServer", &proxy_server)
            .map_err(|e| format!("Failed to set ProxyServer: {}", e))?;
        internet_settings
            .set_value("ProxyEnable", &1u32)
            .map_err(|e| format!("Failed to enable proxy: {}", e))?;
    } else {
        internet_settings
            .set_value("ProxyEnable", &0u32)
            .map_err(|e| format!("Failed to disable proxy: {}", e))?;
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn set_system_proxy_unix(_enable: bool, _host: &str, _port: u16) -> Result<(), String> {
    // Non-windows OS system proxy can be extended here if needed
    Ok(())
}
