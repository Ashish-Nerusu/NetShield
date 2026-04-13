package com.example.demo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class UserSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository users;

    @Autowired
    private PasswordEncoder encoder;

    @Override
    public void run(String... args) throws Exception {
        if (users.findByUsername("admin").isEmpty()) {
            User u = new User();
            u.setUsername("admin");
            u.setEmail("admin@netshield.com");
            u.setPasswordHash(encoder.encode("password123"));
            users.save(u);
            System.out.println("✅ Seeder: Default user 'admin' created.");
        }
    }
}
