package com.secureclipboard;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class SecureClipboardApplication {

    public static void main(String[] args) {
        SpringApplication.run(SecureClipboardApplication.class, args);
    }
}












